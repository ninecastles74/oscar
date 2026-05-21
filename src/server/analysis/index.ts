export { submitManualAnalysis, getManualAnalysis } from "./functions";
export {
  classifyContentTopics,
  listContentTopics,
  getTopicSourceReliability,
} from "./topics/functions";
export { runManualAnalysis, getManualAnalysisResult } from "./manual";
export { runVerificationPipeline, VERDICT_LABELS } from "./verification";
export {
  buildClaimResearch,
  researchClaim,
  researchClaims,
} from "../research";
export { buildSourceChainTrace, traceClaimSourceChain } from "../source-chain";
export {
  aggregateEvidenceQuality,
  classifyEvidenceType,
  computeDynamicWeight,
  scoreClaimEvidenceQuality,
  TYPE_LABELS,
} from "../evidence-weighting";
export {
  analyzeClaimContradictions,
  buildContradictionAnalysis,
  runContradictionAnalysisBatch,
} from "../contradiction";
export {
  enrichVerificationWithMultiModel,
  runMultiModelClaimVerification,
  runMultiModelVerification,
  isMultiModelEnabled,
} from "../multi-model";
export {
  buildClaimConsensus,
  buildClaimConsensusBatch,
  applyClaimConsensusToReport,
  runClaimConsensusEngine,
} from "../consensus-engine";
export { CLAIM_CONSENSUS_DISCLAIMERS } from "@/types/news-platform";
export { AnalysisError } from "./errors";
