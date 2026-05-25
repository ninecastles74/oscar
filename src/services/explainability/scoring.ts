import type { ExplainabilitySummaryJson, ScoreExplainabilityJson } from "./types";

export function summarizeScoreExplainability(
  explainability: ScoreExplainabilityJson,
): ExplainabilitySummaryJson {
  return {
    entityType: explainability.entityType,
    entityId: explainability.entityId,
    entityLabel: explainability.entityLabel,
    overallScore: explainability.overallScore,
    supportingEvidenceCount: explainability.supportingEvidence.length,
    disputedEvidenceCount: explainability.disputedEvidence.length,
    corroboratingSourceCount: explainability.corroboratingSources.length,
    contradictionCount: explainability.contradictionHistory.length,
    omittedContextCount: explainability.omittedContext.length,
    calculationStepCount: explainability.calculationSteps.length,
  };
}
