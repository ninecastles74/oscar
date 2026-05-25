export type {
  EvidenceWeightingAnalysisJson,
  EvidenceWeightingInput,
  WeightedEvidenceItemJson,
} from "./types";

export {
  analyzeEvidenceWeighting,
  analyzeEvidenceWeightingBatch,
  weightSingleEvidence,
} from "./engine";

export {
  BASE_TYPE_WEIGHTS,
  HIGH_TRUST_TYPES,
  LOW_TRUST_TYPES,
  TYPE_LABELS,
  aggregateEvidenceQuality,
  applyWeightsToResearchEvidence,
  classifyEvidenceType,
  computeDynamicWeight,
  supportingWeightSum,
  weightEvidenceItems,
} from "@/server/evidence-weighting";
