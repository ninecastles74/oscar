/** @deprecated Import from `@/server/analysis/verification` — re-exported for compatibility. */
export {
  runVerificationPipeline,
  VERDICT_LABELS,
  type VerificationPipelineResults,
  type VerificationReportBundle,
} from "../verification";

export type VerificationPipelineResult = import("../verification").VerificationReportBundle;
