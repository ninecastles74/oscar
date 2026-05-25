import type { HallucinationDetectionJson, HallucinationDetectionSummaryJson } from "./types";

export function summarizeHallucinationDetection(
  report: HallucinationDetectionJson,
): HallucinationDetectionSummaryJson {
  return {
    claimId: report.claimId,
    hallucinationRiskScore: report.hallucinationRiskScore,
    unsupportedReasoningScore: report.unsupportedReasoningScore,
    isLikelyHallucination: report.isLikelyHallucination,
    adjustedVerdict: report.adjustedVerdict,
    adjustedConfidence: report.adjustedConfidence,
    evidenceBackedOutput: report.evidenceBackedOutput,
    aiDisagreementLevel: report.aiDisagreementLevel,
    findingCount: report.findings.length,
    mitigationApplied: report.mitigationApplied,
  };
}
