import type { PipelineArticleContext } from "../types";
import { classifyClaims } from "./classifyClaims";
import { classifyTopics } from "../topics/classify-topics";
import { compareSources } from "./compareSources";
import { runContradictionAnalysisBatch } from "../../contradiction";
import { extractClaims } from "./extractClaims";
import { extractClaimsWithLlm } from "./extractClaimsLlm";
import { generateFinalReport } from "./generateFinalReport";
import { retrieveEvidence } from "./retrieveEvidence";
import { retrieveEvidenceLive } from "./retrieveEvidenceLive";
import { attachResearchToScoredClaims } from "../../research/research-claims";
import { scoreConfidence } from "./scoreConfidence";
import type { ScoredClaim, VerificationPipelineResults, VerificationReportBundle } from "./types";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import { isServerEnvTruthy } from "../../env/server-env";

export { VERDICT_LABELS } from "./types";
export type { VerificationPipelineResults, VerificationReportBundle } from "./types";

/**
 * Full verification pipeline — uses LLM claim/topic steps when API keys are configured.
 */
export async function runVerificationPipeline(
  article: PipelineArticleContext,
): Promise<VerificationReportBundle> {
  const startedAt = Date.now();
  const stages: string[] = [];

  stages.push("extractClaims");
  let raw = await extractClaimsWithLlm(article.analysisText, article.submissionId);
  if (raw?.length) {
    stages.push("extractClaimsLlm");
  } else {
    raw = extractClaims(article.analysisText, article.submissionId);
    stages.push("extractClaimsHeuristic");
  }

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
  let evidenceByClaimId = await retrieveEvidenceLive(classifiedWithTopics);
  if (Object.keys(evidenceByClaimId).length > 0) {
    stages.push("retrieveEvidenceLive");
    for (const c of classifiedWithTopics) {
      if (!evidenceByClaimId[c.id]?.length) {
        const mock = retrieveEvidence([c]);
        evidenceByClaimId[c.id] = mock[c.id] ?? [];
      }
    }
  } else {
    evidenceByClaimId = retrieveEvidence(classifiedWithTopics);
    stages.push("retrieveEvidenceMock");
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
  };

  stages.push("generateFinalReport");
  const report = generateFinalReport(results);

  return { report, results, stages };
}
