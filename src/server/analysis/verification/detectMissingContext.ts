import type { EvidenceItem } from "@/types/news-platform";
import { runContradictionAnalysisBatch } from "../../contradiction";
import type { ClassifiedClaim, MissingContextFinding } from "./types";

/**
 * 6. detectMissingContext — backed by the contradiction analysis engine (omitted context).
 */
export function detectMissingContext(
  claims: ClassifiedClaim[],
  evidenceByClaimId: Record<string, EvidenceItem[]>,
): MissingContextFinding[] {
  return runContradictionAnalysisBatch(claims, evidenceByClaimId).missingContext;
}
