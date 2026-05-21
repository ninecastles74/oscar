import type { EvidenceItem } from "@/types/news-platform";
import { runContradictionAnalysisBatch } from "../../contradiction";
import type { ClassifiedClaim, ContradictionFinding } from "./types";

/**
 * 5. detectContradictions — backed by the contradiction analysis engine.
 */
export function detectContradictions(
  claims: ClassifiedClaim[],
  evidenceByClaimId: Record<string, EvidenceItem[]>,
): ContradictionFinding[] {
  return runContradictionAnalysisBatch(claims, evidenceByClaimId).contradictions;
}
