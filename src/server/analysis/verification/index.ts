import type { PipelineArticleContext } from "../types";
import { classifyClaims } from "./classifyClaims";
import { classifyTopics } from "../topics/classify-topics";
import { compareSources } from "./compareSources";
import { runContradictionAnalysisBatch } from "../../contradiction";
import { extractClaimsWithLlm } from "./extractClaimsLlm";
import { generateFinalReport } from "./generateFinalReport";
import { retrieveEvidenceLive } from "./retrieveEvidenceLive";
import { attachResearchToScoredClaims } from "../../research/research-claims";
import { scoreConfidence } from "./scoreConfidence";
import type { ScoredClaim, VerificationPipelineResults, VerificationReportBundle } from "./types";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import {
  getLastGeminiAttemptLog,
  getLastGeminiError,
} from "../../ai/gemini-client";
import {
  buildGeminiCapacityWarning,
  getGeminiCapacityAdminLog,
  hadGeminiCapacityFailure,
  resetGeminiResilienceState,
} from "../../ai/gemini-resilience";
import { AnalysisError } from "../errors";

export { VERDICT_LABELS } from "./types";
export type { VerificationPipelineResults, VerificationReportBundle } from "./types";

/**
 * Live-only verification pipeline — no mock evidence or heuristic claim extraction.
 */
export async function runVerificationPipeline(
  article: PipelineArticleContext,
): Promise<VerificationReportBundle> {
  resetGeminiResilienceState();

  if (!isGoogleAiConfigured()) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "GEMINI_API_KEY is required for live analysis and web research.",
      503,
    );
  }

  const startedAt = Date.now();
  const stages: string[] = [];
  const pipelineWarnings: import("./types").VerificationPipelineResults["pipelineWarnings"] = [];

  stages.push("extractClaims");
  const raw = await extractClaimsWithLlm(article.analysisText, article.submissionId);
  if (!raw?.length) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Could not extract claims with live AI (OpenAI or Gemini). Check API keys and redeploy.",
      503,
    );
  }
  stages.push("extractClaimsLlm");

  stages.push("classifyClaims");
  const classified = classifyClaims(raw);

  stages.push("classifyTopics");
  const topicResult = await classifyTopics({
    title: article.title,
    summary: article.summary,
    body: article.analysisText,
    claims: classified.map((c) => ({ id: c.id, text: c.text })),
  });
  if (topicResult.article.classifier !== "keyword") stages.push("classifyTopicsLlm");

  const classifiedWithTopics = classified.map((c) => ({
    ...c,
    topicClassification: topicResult.claimClassifications[c.id],
  }));

  stages.push("retrieveEvidence");
  const evidenceByClaimId = await retrieveEvidenceLive(classifiedWithTopics);
  const missingLive = classifiedWithTopics.filter((c) => !evidenceByClaimId[c.id]?.length);

  if (missingLive.length > 0) {
    const adminDetails = [
      ...getGeminiCapacityAdminLog(),
      ...getLastGeminiAttemptLog(),
      getLastGeminiError(),
    ]
      .filter(Boolean)
      .join("; ");

    pipelineWarnings.push(
      buildGeminiCapacityWarning(
        adminDetails || `Missing live evidence for ${missingLive.length} claim(s).`,
      ),
    );

    console.warn(
      "[verification] live web evidence degraded:",
      missingLive.map((c) => c.id).join(", "),
      adminDetails ? `| ${adminDetails}` : "",
    );
    stages.push("retrieveEvidenceLiveDegraded");
  } else {
    stages.push("retrieveEvidenceLive");
  }

  if (hadGeminiCapacityFailure() && pipelineWarnings.length === 0) {
    pipelineWarnings.push(buildGeminiCapacityWarning(getGeminiCapacityAdminLog().join("; ")));
  }

  stages.push("compareSources");
  const comparisons = compareSources(classifiedWithTopics, evidenceByClaimId);

  stages.push("analyzeContradictions");
  const {
    byClaimId: contradictionAnalyses,
    contradictions,
    missingContext,
  } = runContradictionAnalysisBatch(classifiedWithTopics, evidenceByClaimId);

  stages.push("scoreConfidence");
  const scoredClaims = scoreConfidence(
    classifiedWithTopics,
    evidenceByClaimId,
    contradictions,
    missingContext,
  );

  stages.push("researchClaims");
  const researchedClaims = attachResearchToScoredClaims(
    scoredClaims,
    contradictions,
    contradictionAnalyses,
  );

  const results: VerificationPipelineResults = {
    article,
    articleTopicClassification: topicResult.article,
    claimTopicClassifications: topicResult.claimClassifications,
    classifiedClaims: classifiedWithTopics,
    evidenceByClaimId,
    comparisons,
    contradictions,
    missingContext,
    contradictionAnalyses,
    scoredClaims: researchedClaims as ScoredClaim[],
    issueFlags: [],
    issueSummary: {
      contradictions: contradictions.length,
      missingContext: missingContext.length,
      emotionalLanguage: 0,
      unsupportedClaims: researchedClaims.filter(
        (c) => c.claimResearch?.unsupported.isUnsupported,
      ).length,
      totalClaims: scoredClaims.length,
    },
    startedAt,
    pipelineWarnings: pipelineWarnings.length > 0 ? pipelineWarnings : undefined,
  };

  stages.push("generateFinalReport");
  const report = generateFinalReport(results);

  return { report, results, stages };
}
