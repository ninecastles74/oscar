export type {
  MultiModelArbitrationBatchInput,
  MultiModelArbitrationBatchJson,
  MultiModelArbitrationInput,
  MultiModelArbitrationJson,
  MultiModelWithClaimConsensusJson,
} from "./types";

export { ALLOWED_VERDICTS, MULTI_MODEL_DISCLAIMERS } from "./types";

export {
  runMultiModelArbitration,
  runMultiModelArbitrationBatch,
  runMultiModelArbitrationWithClaimConsensus,
} from "./engine";

export { applyHallucinationMitigation } from "./hallucination-guard";

export {
  arbitrateSingleClaim,
  enrichVerificationWithMultiModel,
  runMultiModelVerification,
  buildMultiModelConsensus,
  arbitrateConsensus,
  detectDisagreements,
  isMultiModelEnabled,
  MODEL_WEIGHTS,
} from "@/server/multi-model";
