import type {
  EvidenceDocumentType,
  EvidenceItem,
  EvidenceQualityAssessment,
  EvidenceWeightBreakdown,
} from "@/types/news-platform";

/** Input for the evidence weighting engine. */
export interface EvidenceWeightingInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
}

/** Per-item weighted evidence (JSON-serializable). */
export interface WeightedEvidenceItemJson {
  id: string;
  sourceId: string;
  sourceName?: string;
  evidenceType: EvidenceDocumentType;
  dynamicWeight: number;
  weightBreakdown: EvidenceWeightBreakdown;
  stance: EvidenceItem["stance"];
  supports: boolean;
}

/**
 * Structured JSON output from the Evidence Weighting Engine.
 */
export interface EvidenceWeightingAnalysisJson {
  claimId: string;
  aggregateScore: number;
  supportingWeightTotal: number;
  evidenceCount: number;
  supportingCount: number;
  weightedEvidence: WeightedEvidenceItemJson[];
  typeDistribution: EvidenceQualityAssessment["typeDistribution"];
  highestWeightEvidenceId?: string;
  lowestWeightEvidenceId?: string;
}
