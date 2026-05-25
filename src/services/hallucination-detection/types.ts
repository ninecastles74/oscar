import type {
  HallucinationDetectionInput,
  HallucinationDetectionReport,
  HallucinationFinding,
  HallucinationMitigationResult,
  HallucinationSignalType,
} from "@/server/hallucination-detection";

/** Structured JSON from the Hallucination Detection Engine. */
export type HallucinationDetectionJson = HallucinationDetectionReport;

export interface HallucinationDetectionSummaryJson {
  claimId: string;
  hallucinationRiskScore: number;
  unsupportedReasoningScore: number;
  isLikelyHallucination: boolean;
  adjustedVerdict: HallucinationDetectionReport["adjustedVerdict"];
  adjustedConfidence: number;
  evidenceBackedOutput: boolean;
  aiDisagreementLevel: number;
  findingCount: number;
  mitigationApplied: boolean;
}

/** Structured JSON from the AI Hallucination Detection Layer. */
export type AiHallucinationDetectionJson = HallucinationDetectionReport;

export type {
  HallucinationDetectionInput,
  HallucinationFinding,
  HallucinationSignalType,
  HallucinationMitigationResult,
  AiHallucinationDetectionReport,
} from "@/server/hallucination-detection";
