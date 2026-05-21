export {
  BASE_TYPE_WEIGHTS,
  HIGH_TRUST_TYPES,
  LOW_TRUST_TYPES,
  TYPE_LABELS,
} from "./config";
export { classifyEvidenceType } from "./classify-evidence";
export {
  applyWeightsToResearchEvidence,
  computeDynamicWeight,
} from "./compute-weight";
export {
  aggregateEvidenceQuality,
  supportingWeightSum,
  weightEvidenceItems,
} from "./aggregate-quality";
export { scoreClaimEvidenceQuality } from "./functions";
