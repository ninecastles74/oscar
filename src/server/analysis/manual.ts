import type { ManualSubmission, UserAnalysisRequest } from "@/types/news-platform";
import { AnalysisError } from "./errors";
import type { AnalysisTrigger } from "./context";
import { applyClaimConsensusToReport } from "../consensus-engine";
import { enrichVerificationWithMultiModel } from "../multi-model";
import { getAiAnalysisDiagnostics } from "./ai-diagnostics";
import { runVerificationPipeline } from "./verification";
import {
  computeAndStoreReliabilityScores,
  getReliabilityBundleByArticleId,
} from "../reliability/engine";
import { buildTransparencyExplainabilityBundle } from "../transparency-explainability/build-bundle";
import { buildFinalIntelligenceReport } from "../orchestration/build-final-intelligence";
import type { ArticleOrchestrationReport } from "../orchestration/types";
import type { ManualAnalysisResponse, ParsedArticleInput, PipelineArticleContext } from "./types";
import { fetchArticleFromUrl } from "./url-fetch";
import {
  loadManualRequest,
  loadManualSubmission,
  persistManualRequest,
  persistManualSubmission,
  syncManualRequest,
  syncManualSubmission,
} from "./manual-persist";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function parsedFromText(text: string, opts: { url?: string; title?: string }): ParsedArticleInput {
  const trimmed = text.trim();
  if (trimmed.length < 80) {
    throw new AnalysisError(
      "INSUFFICIENT_CONTENT",
      "Pasted text must be at least 80 characters for analysis.",
    );
  }
  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  const title =
    opts.title?.trim() ||
    (firstLine.length > 10 && firstLine.length < 200 ? firstLine : "Pasted article analysis");

  return {
    title: title.slice(0, 300),
    url: opts.url ?? "manual://pasted-text",
    summary: trimmed.slice(0, 500),
    analysisText: trimmed.slice(0, 50_000),
    language: "en",
    contentRights: "user_provided",
    rightsNote: "User-provided text analyzed directly with their consent.",
  };
}

export interface BeginManualAnalysisInput {
  url?: string;
  text?: string;
  title?: string;
  userNotes?: string;
  language?: string;
  userId?: string;
  analysisTrigger?: AnalysisTrigger;
}

/** Create a processing request (persisted to KV when configured). */
export function beginManualAnalysis(input: BeginManualAnalysisInput): {
  requestId: string;
  submissionId: string;
} {
  const hasUrl = !!input.url?.trim();
  const hasText = !!input.text?.trim();

  if (hasUrl === hasText) {
    throw new AnalysisError("VALIDATION_ERROR", "Provide exactly one of url or text.");
  }

  const submissionId = newId("sub");
  const requestId = newId("req");
  const submittedAt = new Date().toISOString();

  const submission: ManualSubmission = {
    id: submissionId,
    url: hasUrl ? input.url!.trim() : undefined,
    text: hasText ? input.text!.trim() : undefined,
    title: input.title,
    language: input.language ?? "en",
    userNotes: input.userNotes,
    submittedAt,
    status: "processing",
  };

  const request: UserAnalysisRequest = {
    id: requestId,
    userId: input.userId,
    type: hasUrl ? "manual_url" : "manual_text",
    submission,
    status: "processing",
    progress: 5,
    createdAt: submittedAt,
    startedAt: submittedAt,
  };

  persistManualSubmission(submission);
  persistManualRequest(request);

  return { requestId, submissionId };
}

/** Run the full pipeline for an existing manual request (background-safe). */
export async function executeManualAnalysis(requestId: string): Promise<void> {
  const request = await loadManualRequest(requestId);
  if (!request?.submission) return;

  const submission =
    (await loadManualSubmission(request.submission.id)) ?? request.submission;
  const input: BeginManualAnalysisInput = {
    url: submission.url,
    text: submission.text,
    title: submission.title,
    language: submission.language,
    userNotes: submission.userNotes,
    userId: request.userId,
    analysisTrigger: "user",
  };

  const hasUrl = !!input.url?.trim();
  const hasText = !!input.text?.trim();
  const submissionId = submission.id;

  try {
    let parsed: ParsedArticleInput;
    request.progress = 15;
    syncManualRequest(request);

    if (hasUrl) {
      parsed = await fetchArticleFromUrl(input.url!.trim());
      if (input.title) parsed.title = input.title;
    } else {
      parsed = parsedFromText(input.text!, { title: input.title });
    }

    if (parsed.analysisText.length < 40) {
      throw new AnalysisError(
        "INSUFFICIENT_CONTENT",
        "Not enough readable content to extract claims. Try pasting the full article text.",
      );
    }

    const pipelineArticle: PipelineArticleContext = {
      ...parsed,
      submissionId,
      language: input.language ?? parsed.language,
    };

    request.progress = 35;
    syncManualRequest(request);

    let bundle = runVerificationPipeline(pipelineArticle);
      console.log(
        "[executeManualAnalysis] AI diagnostics",
        JSON.stringify(getAiAnalysisDiagnostics()),
      );
    bundle = await enrichVerificationWithMultiModel(bundle, "user");
    const { report, results } = bundle;

    const reliability = computeAndStoreReliabilityScores({
      report,
      results,
      article: pipelineArticle,
      reportId: requestId,
      authorDisplayName: parsed.author,
    });

    const reportWithConsensus = applyClaimConsensusToReport(report, reliability);

    submission.status = "completed";
    submission.report = reportWithConsensus;
    submission.title = parsed.title;

    request.status = "completed";
    request.progress = 100;
    request.completedAt = new Date().toISOString();
    request.report = reportWithConsensus;

    syncManualSubmission(submission);
    syncManualRequest(request);

    if (process.env.FINAL_INTELLIGENCE_ON_MANUAL === "true") {
      const articleResult: ArticleOrchestrationReport = {
        articleId: requestId,
        report: reportWithConsensus,
        results,
        reliability,
        transparency: buildTransparencyExplainabilityBundle({
          report: reportWithConsensus,
          bundle: reliability,
          results,
        }),
        stagesCompleted: [
          "verification",
          "multi_model",
          "reliability",
          "claim_consensus",
          "transparency",
        ],
        computedAt: new Date().toISOString(),
      };
      try {
        const full = await buildFinalIntelligenceReport({
          article: pipelineArticle,
          trigger: "user",
          reportId: requestId,
          authorDisplayName: parsed.author,
          articleResult,
          skipMultiModel: true,
        });
        request.finalIntelligence = {
          finalArticleReliability: full.finalArticleReliability,
          finalSourceReliability: full.finalSourceReliability,
          finalAuthorReliability: full.finalAuthorReliability,
          finalStoryConfidence: full.finalStoryConfidence,
          finalUncertaintyLevel: full.finalUncertaintyLevel,
          disclaimer: full.disclaimer,
          intelligenceSummary: full.intelligenceSummary,
          computedAt: full.computedAt,
        };
        syncManualRequest(request);
      } catch {
        /* best-effort */
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    submission.status = "failed";
    submission.error = message;
    request.status = "failed";
    request.error = message;
    request.completedAt = new Date().toISOString();
    syncManualSubmission(submission);
    syncManualRequest(request);
    console.error("[executeManualAnalysis]", message);
  }
}

/** Synchronous path (local/tests) — begin + execute in one call. */
export async function runManualAnalysis(
  input: BeginManualAnalysisInput,
): Promise<ManualAnalysisResponse> {
  const { requestId } = beginManualAnalysis(input);
  await executeManualAnalysis(requestId);
  const result = await getManualAnalysisResult(requestId);
  if (!result) {
    const request = await loadManualRequest(requestId);
    if (request?.status === "failed") {
      throw new AnalysisError("ANALYSIS_FAILED", request.error ?? "Analysis failed");
    }
    throw new AnalysisError("ANALYSIS_FAILED", "Analysis did not complete");
  }
  return result;
}

export async function getManualAnalysisResult(
  requestId: string,
): Promise<ManualAnalysisResponse | null> {
  const request = await loadManualRequest(requestId);
  if (!request?.submission) return null;
  const submission = (await loadManualSubmission(request.submission.id)) ?? request.submission;
  if (request.status !== "completed" || !request.report) return null;
  const reliability =
    getReliabilityBundleByArticleId(submission.id) ??
    getReliabilityBundleByArticleId(requestId);
  if (!reliability) return null;

  return {
    request,
    submission,
    report: request.report,
    reliability,
    finalIntelligence: request.finalIntelligence,
  };
}

export async function getManualAnalysisStatus(
  requestId: string,
): Promise<UserAnalysisRequest | null> {
  return (await loadManualRequest(requestId)) ?? null;
}
