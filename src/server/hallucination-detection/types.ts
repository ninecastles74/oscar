import type {
  EvidenceItem,
  ModelClaimVerdict,
  ResearchEvidence,
  UnsupportedAssessment,
  Verdict,
} from "@/types/news-platform";

export type HallucinationSignalType =
  | "no_evidence"
  | "weak_evidence_only"
  | "model_admits_gap"
  | "overconfident_phrasing"
  | "unsupported_statistic"
  | "unsupported_causal"
  | "contradicting_evidence"
  | "model_disagreement"
  | "unsupported_sourcing"
  | "unsupported_ai_conclusion"
  | "fabricated_citation"
  | "weak_evidence_chain"
  | "low_confidence_reasoning";

export interface HallucinationFinding {
  type: HallucinationSignalType;
  severity: "info" | "warning" | "critical";
  description: string;
}

export interface HallucinationDetectionInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
  modelVerdicts?: ModelClaimVerdict[];
  researchEvidence?: ResearchEvidence[];
  claimVerifiable?: boolean;
  pipelineVerdict?: Verdict;
  pipelineConfidence?: number;
}

export interface HallucinationDetectionReport {
  claimId: string;
  claimText: string;
  /** 0–100 overall AI hallucination risk (higher = riskier). */
  hallucinationRiskScore: number;
  /** 0–100 unsupported / weak AI reasoning (higher = worse grounding). */
  unsupportedReasoningScore: number;
  isLikelyHallucination: boolean;
  adjustedVerdict: Verdict;
  adjustedConfidence: number;
  findings: HallucinationFinding[];
  mitigationApplied: boolean;
  uncertaintyHandled: boolean;
  /** True when output meets evidence-backed requirements after mitigation. */
  evidenceBackedOutput: boolean;
  /** 0–100 model disagreement intensity (higher = more disagreement). */
  aiDisagreementLevel: number;
  notes: string[];
  unsupportedAssessment: UnsupportedAssessment | null;
  computedAt: string;
}

/** Alias for the AI Hallucination Detection Layer structured JSON. */
export type AiHallucinationDetectionReport = HallucinationDetectionReport;
