import { getLastGeminiError } from "../ai/gemini-client";
import { getLastOpenAiError } from "../ai/openai-client";
import { AnalysisError } from "../analysis/errors";
import {
  hasAnyAiApiKey,
  isOpenAiConfigured,
  isServerEnvTruthy,
  listDetectedAiEnvKeys,
} from "../env/server-env";
import type {
  AnalysisReport,
  EvidenceItem,
  MultiModelVerificationReport,
} from "@/types/news-platform";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import {
  availableProviders,
  isGeminiLiveEnabled,
  isMultiModelEnabled,
  REVIEW_CONFIDENCE_THRESHOLD,
  REVIEW_VERDICTS,
} from "./config";
import { getServerEnv } from "../env/server-env";
import { isGeminiGoogleSearchEnabled, isGoogleAiConfigured } from "../ai/google-api-key";
import { buildMultiModelConsensus, toClaimVerification } from "./consensus";
import { providersInvolved } from "./disagreement";
import { getLastAnthropicError, verifyClaimWithAnthropic } from "./providers/anthropic";
import { verifyClaimWithGemini } from "./providers/gemini";
import { verifyClaimWithOpenAI } from "./providers/openai";
import type { ModelClaimVerdict } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

function liveAiError(message: string): never {
  throw new AnalysisError("LIVE_AI_REQUIRED", message, 503);
}

function needsClaudeReview(primary: ModelClaimVerdict, pipeline: { verdict: string; confidence: number }): boolean {
  return (
    REVIEW_VERDICTS.includes(primary.verdict) ||
    primary.confidence < REVIEW_CONFIDENCE_THRESHOLD ||
    REVIEW_VERDICTS.includes(pipeline.verdict as ModelClaimVerdict["verdict"])
  );
}

async function verifyOneClaim(
  claim: { id: string; text: string; verdict: string; confidence: number },
  evidence: EvidenceItem[],
  contradiction?: import("@/types/news-platform").ContradictionAnalysisReport,
): Promise<{ verification: import("@/types/news-platform").MultiModelClaimVerification; stages: string[] }> {
  const stages: string[] = [];
  const evidencePayload = evidence.map((e) => ({
    stance: e.stance,
    sourceName: e.sourceName,
    excerpt: e.excerpt,
  }));

  const pipelineFallback = {
    verdict: claim.verdict as import("@/types/news-platform").Verdict,
    confidence: claim.confidence,
  };

  let primary: ModelClaimVerdict | null = null;
  if (isOpenAiConfigured()) {
    stages.push("openai_primary");
    primary = await verifyClaimWithOpenAI({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidencePayload,
      role: "primary",
    });
    if (!primary) {
      const err = getLastOpenAiError();
      liveAiError(
        `OpenAI primary verification failed for claim "${claim.text.slice(0, 80)}…"${err ? `: ${err}` : ""}`,
      );
    }
  } else if (isGeminiLiveEnabled()) {
    stages.push("gemini_primary");
    primary = await verifyClaimWithGemini({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidencePayload,
      role: "primary",
    });
    if (!primary) {
      liveAiError(`Gemini primary verification failed for claim "${claim.text.slice(0, 80)}…"`);
    }
  } else {
    liveAiError("Configure OPENAI_API_KEY or GEMINI_API_KEY for live multi-model verification.");
  }

  let review: ModelClaimVerdict | null = null;
  const runReview = needsClaudeReview(primary, pipelineFallback);
  if (runReview) {
    if (isServerEnvTruthy("ANTHROPIC_API_KEY")) {
      stages.push("claude_review");
      review = await verifyClaimWithAnthropic({
        claimId: claim.id,
        claimText: claim.text,
        evidence: evidencePayload,
        role: "review",
        priorVerdict: primary,
      });
      if (!review) {
        const err = getLastAnthropicError();
        liveAiError(
          `Anthropic review failed for claim "${claim.text.slice(0, 80)}…"${err ? `: ${err}` : ""}`,
        );
      }
    } else if (isGeminiLiveEnabled()) {
      stages.push("gemini_review");
      review = await verifyClaimWithGemini({
        claimId: claim.id,
        claimText: claim.text,
        evidence: evidencePayload,
        role: "review",
        priorVerdict: primary,
      });
      if (!review) {
        liveAiError(`Gemini review failed for claim "${claim.text.slice(0, 80)}…"`);
      }
    } else {
      liveAiError("Uncertain claim requires Anthropic or Gemini for live review.");
    }
  } else {
    review = {
      provider: "anthropic",
      model: "skipped",
      role: "review",
      verdict: primary.verdict,
      confidence: primary.confidence,
      reasoning: "Skipped — primary confidence sufficient and not disputed.",
      skipped: true,
      skipReason: "not_uncertain",
    };
  }

  if (!isGeminiLiveEnabled()) {
    liveAiError("GEMINI_API_KEY is required for live corroboration with Google Search.");
  }

  const hasLiveWebEvidence = evidence.some((e) => e.id?.includes("-live-e"));
  stages.push(hasLiveWebEvidence ? "gemini_corroboration_json" : "gemini_corroboration");
  let corroboration = await verifyClaimWithGemini({
    claimId: claim.id,
    claimText: claim.text,
    evidence: evidencePayload,
    role: "corroboration",
    priorVerdict: review.skipped ? primary : review,
    skipGoogleSearch: hasLiveWebEvidence,
  });

  if (!corroboration && hasLiveWebEvidence) {
    const prior = review.skipped ? primary : review;
    stages.push("gemini_corroboration_evidence_fallback");
    corroboration = {
      provider: "google",
      model: "live-evidence-fallback",
      role: "corroboration",
      verdict: prior.verdict,
      confidence: prior.confidence,
      reasoning:
        "Corroboration uses attached live web evidence; Gemini JSON corroboration was unavailable.",
      geminiMeta: {
        liveApiCalled: false,
        searchPerformed: false,
        searchQueryCount: 0,
        webSearchQueries: [],
        sourcesUsed: [],
      },
    };
  }

  if (!corroboration) {
    const err = getLastGeminiError();
    liveAiError(
      `Gemini corroboration failed for claim "${claim.text.slice(0, 80)}…"${err ? `: ${err}` : ""}`,
    );
  }

  const modelVerdicts = [primary, review, corroboration];
  stages.push("consensus");
  const consensus = buildMultiModelConsensus(claim.id, claim.text, modelVerdicts, pipelineFallback);

  return {
    verification: toClaimVerification(claim.id, claim.text, consensus, stages),
    stages,
  };
}

export async function arbitrateSingleClaim(
  claim: { id: string; text: string; verdict: string; confidence: number },
  evidence: EvidenceItem[],
  contradiction?: import("@/types/news-platform").ContradictionAnalysisReport,
) {
  return verifyOneClaim(claim, evidence, contradiction);
}

const MANUAL_MAX_CLAIMS = Number(getServerEnv("MANUAL_MULTIMODEL_MAX_CLAIMS")) || 5;
const SCHEDULED_MAX_CLAIMS = Number(getServerEnv("SCHEDULED_MULTIMODEL_MAX_CLAIMS")) || 5;
const MANUAL_CONCURRENCY = Number(getServerEnv("MANUAL_MULTIMODEL_CONCURRENCY")) || 1;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function countLiveEvidenceClaims(results: VerificationPipelineResults): number {
  return Object.values(results.evidenceByClaimId).filter((items) =>
    items?.some((e) => e?.id?.includes("-live-e")),
  ).length;
}

export async function runMultiModelVerification(
  results: VerificationPipelineResults,
  options?: { trigger?: "user" | "scheduled" },
): Promise<MultiModelVerificationReport> {
  let claims = results.scoredClaims;
  if (options?.trigger === "user" && claims.length > MANUAL_MAX_CLAIMS) {
    claims = claims.slice(0, MANUAL_MAX_CLAIMS);
  }
  if (options?.trigger === "scheduled" && claims.length > SCHEDULED_MAX_CLAIMS) {
    claims = claims.slice(0, SCHEDULED_MAX_CLAIMS);
  }

  const verifications = await mapWithConcurrency(claims, MANUAL_CONCURRENCY, async (claim) => {
    const evidence = results.evidenceByClaimId[claim.id] ?? claim.evidence ?? [];
    const contradiction = results.contradictionAnalyses?.[claim.id];
    const { verification } = await verifyOneClaim(claim, evidence, contradiction);
    return verification;
  });

  const disagreementCount = verifications.filter(
    (v) => v.consensus.disagreementDetected,
  ).length;
  const overallConfidence =
    verifications.length === 0
      ? 0
      : clampScore(
          verifications.reduce((s, v) => s + v.consensus.finalConfidence, 0) /
            verifications.length,
        );

  const modelsUsed = [
    ...new Set(verifications.flatMap((v) => providersInvolved(v.consensus.modelVerdicts))),
  ];
  if (modelsUsed.length === 0) {
    for (const p of availableProviders()) modelsUsed.push(p);
  }

  let geminiLiveCalls = 0;
  let claimsWithGoogleSearch = 0;
  let totalSearchQueries = 0;
  let totalGeminiTokens = 0;
  const geminiAttempts = verifications.filter((v) =>
    (v.stagesRun ?? []).includes("gemini_corroboration"),
  ).length;
  for (const v of verifications) {
    const gem = v.consensus.modelVerdicts.find((m) => m.provider === "google");
    if (gem?.geminiMeta?.liveApiCalled) geminiLiveCalls += 1;
    if (gem?.geminiMeta?.searchPerformed) {
      claimsWithGoogleSearch += 1;
      totalSearchQueries += gem.geminiMeta.searchQueryCount;
    }
    if (gem?.geminiMeta?.totalTokens) totalGeminiTokens += gem.geminiMeta.totalTokens;
  }

  const liveEvidenceClaims = countLiveEvidenceClaims(results);

  const geminiUsage = {
    configured: isGoogleAiConfigured(),
    googleSearchEnabled: isGeminiGoogleSearchEnabled(),
    liveApiCalls: geminiLiveCalls,
    claimsWithGoogleSearch,
    totalSearchQueries,
    totalTokens: totalGeminiTokens > 0 ? totalGeminiTokens : undefined,
    runtimeEnvKeys: listDetectedAiEnvKeys(),
    liveApiAttempts: geminiAttempts,
    lastApiError: geminiLiveCalls === 0 && geminiAttempts > 0 ? getLastGeminiError() : undefined,
    liveEvidenceClaims,
  };

  const geminiNote = isGoogleAiConfigured()
    ? geminiLiveCalls > 0
      ? ` Gemini: ${geminiLiveCalls} live call(s), ${totalSearchQueries} Google Search quer${totalSearchQueries === 1 ? "y" : "ies"}.`
      : ` Gemini key set but no live corroboration responses (${geminiAttempts} attempt(s)${getLastGeminiError() ? ` — ${getLastGeminiError()}` : ""}).`
    : " Gemini: not configured (set GOOGLE_AI_API_KEY or GEMINI_API_KEY).";

  return {
    articleId: results.article.submissionId,
    claims: verifications,
    overallConfidence,
    disagreementCount,
    modelsUsed,
    geminiUsage,
    summary: `Live multi-model verification: ${verifications.length} claim(s), ${disagreementCount} with model disagreement. Overall confidence ${overallConfidence}/100.${geminiNote}`,
    computedAt: new Date().toISOString(),
  };
}

export function applyMultiModelToReport(
  report: AnalysisReport,
  multiModel: MultiModelVerificationReport,
): AnalysisReport {
  const byClaim = new Map(multiModel.claims.map((c) => [c.claimId, c]));
  const claims = report.claims.map((c) => {
    const mm = byClaim.get(c.id);
    if (!mm) return c;
    return {
      ...c,
      verdict: mm.consensus.finalVerdict,
      confidence: mm.consensus.finalConfidence,
      multiModelVerification: mm,
      reasoning: [
        c.reasoning,
        `Multi-model (${mm.consensus.arbitrationMethod}): ${mm.consensus.consensusSummary}`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });

  const overallConfidence =
    claims.length === 0
      ? report.overallConfidence
      : clampScore(claims.reduce((s, c) => s + c.confidence, 0) / claims.length);

  return {
    ...report,
    claims,
    overallConfidence,
    multiModelVerification: multiModel,
    summary: `${report.summary} ${multiModel.summary}`,
  };
}

export async function enrichVerificationWithMultiModel(
  bundle: import("../analysis/verification/types").VerificationReportBundle,
  trigger: "user" | "scheduled" = "user",
): Promise<import("../analysis/verification/types").VerificationReportBundle> {
  if (!isMultiModelEnabled(trigger)) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Multi-model verification is disabled. Live analysis cannot run.",
      503,
    );
  }

  const multiModel = await runMultiModelVerification(bundle.results, { trigger });
  const report = applyMultiModelToReport(bundle.report, multiModel);
  return {
    ...bundle,
    report,
    results: {
      ...bundle.results,
      scoredClaims: report.claims as typeof bundle.results.scoredClaims,
    },
    stages: [...bundle.stages, "multiModelVerification"],
  };
}
