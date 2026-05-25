export type {
  HallucinationDetectionInput,
  HallucinationDetectionJson,
  AiHallucinationDetectionJson,
  HallucinationDetectionSummaryJson,
  HallucinationFinding,
  HallucinationSignalType,
  HallucinationMitigationResult,
} from "./types";

export {
  detectHallucination,
  detectAiHallucination,
  detectHallucinationBatch,
  mitigateHallucination,
} from "./engine";

export { summarizeHallucinationDetection } from "./scoring";

export {
  buildHallucinationDetectionReport,
  buildAiHallucinationDetectionReport,
  applyHallucinationMitigation,
  collectHallucinationFindings,
  collectAiHallucinationSignals,
  computeHallucinationRiskScore,
  computeUnsupportedReasoningScore,
} from "@/server/hallucination-detection";
