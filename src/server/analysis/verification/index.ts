import type { PipelineArticleContext } from "../types";
import { classifyClaims } from "./classifyClaims";
import { classifyTopicsForPipeline } from "./classifyTopics";
import { compareSources } from "./compareSources";
import { runContradictionAnalysisBatch } from "../../contradiction";
import { extractClaims } from "./extractClaims";
import { generateFinalReport } from "./generateFinalReport";
import { retrieveEvidence } from "./retrieveEvidence";
import { attachResearchToScoredClaims } from "../../research/research-claims";
import { scoreConfidence } from "./scoreConfidence";
import type { ScoredClaim, VerificationPipelineResults, VerificationReportBundle } from "./types";

export { VERDICT_LABELS } from "./types";
export type { VerificationPipelineResults, VerificationReportBundle } from "./types";

/**
 * Full verification pipeline — per-claim only, evidence-backed conclusions.
 */
export function runVerificationPipeline(article: PipelineArticleContext): VerificationReportBundle {
  const startedAt = Date.now();
  const stages: string[] = [];

  stages.push("extractClaims");
  const raw = extractClaims(article.analysisText, article.submissionId);

  stages.push("classifyClaims");
  const classified = classifyClaims(raw);

  stages.push("classifyTopics");
  const topicResult = classifyTopicsForPipeline(article, classified);
  const classifiedWithTopics = classified.map((c) => ({
    ...c,
    topicClassification: topicResult.claimClassifications[c.id],
  }));

  stages.push("retrieveEvidence");
  const evidenceByClaimId = retrieveEvidence(classifiedWithTopics);

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
