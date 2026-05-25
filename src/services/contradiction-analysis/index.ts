export type {
  ContradictionAnalysisBatchJson,
  ContradictionAnalysisInput,
  ContradictionAnalysisJson,
  ContradictionOmissionAnalysisJson,
  ContradictionSeverityBreakdown,
} from "./types";

export {
  analyzeContradictions,
  analyzeContradictionsBatch,
  evidenceFromCoverage,
} from "./engine";

export {
  analyzeContradictionAndOmission,
  analyzeContradictionAndOmissionBatch,
} from "./omission-engine";

export type { ContradictionOmissionInput } from "./omission-engine";

export {
  buildContradictionAnalysis,
  runContradictionAnalysisBatch,
} from "@/server/contradiction";

export type { PeerArticleSlice, ContradictionBatchResult } from "@/server/contradiction";
