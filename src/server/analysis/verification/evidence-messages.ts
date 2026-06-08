import type { PipelineWarning } from "@/types/news-platform";

export const PARTIAL_EVIDENCE_USER_WARNING =
  "Some claims could not be verified with live evidence.";

export const CLAIM_EVIDENCE_FAILED_WARNING = "Live evidence retrieval failed for this claim.";

export function buildPartialEvidenceWarning(details: {
  succeeded: number;
  failed: number;
  total: number;
  adminDetail?: string;
}): PipelineWarning {
  return {
    code: "PARTIAL_LIVE_EVIDENCE",
    message: PARTIAL_EVIDENCE_USER_WARNING,
    details:
      details.adminDetail ??
      `${details.succeeded}/${details.total} claims retrieved live evidence; ${details.failed} failed.`,
  };
}
