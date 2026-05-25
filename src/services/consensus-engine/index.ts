export type {
  ClaimConsensusBatchInput,
  ClaimConsensusBatchJson,
  ClaimConsensusInput,
  ClaimConsensusJson,
  ClaimConsensusSummaryJson,
} from "./types";

export {
  runClaimConsensus,
  runClaimConsensusBatch,
  summarizeClaimConsensus,
} from "./engine";

export {
  buildClaimConsensus,
  buildClaimConsensusBatch,
  applyClaimConsensusToReport,
  applyClaimConsensusToPipelineResults,
  extractConsensusSignals,
  resolveConsensusVerdict,
  SIGNAL_WEIGHTS,
  SIGNAL_LABELS,
  VERDICT_THRESHOLDS,
} from "@/server/consensus-engine";
