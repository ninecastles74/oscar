export {
  buildClaimConsensus,
  buildClaimConsensusBatch,
  applyClaimConsensusToReport,
  applyClaimConsensusToPipelineResults,
} from "./build-consensus";
export { extractConsensusSignals } from "./signals";
export { resolveConsensusVerdict } from "./verdict-resolver";
export { SIGNAL_WEIGHTS, SIGNAL_LABELS, VERDICT_THRESHOLDS } from "./config";
export { runClaimConsensusEngine } from "./functions";
