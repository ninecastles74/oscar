import type { SourceComparison, SourceReport } from "@/types/news-platform";
import type { EvidenceItem } from "@/types/news-platform";
import { approvedSourceById } from "../sources";
import type { ClassifiedClaim } from "./types";

/**
 * 4. compareSources — per-claim matrix of how each outlet reports the statement.
 */
export function compareSources(
  claims: ClassifiedClaim[],
  evidenceByClaimId: Record<string, EvidenceItem[]>,
): SourceComparison[] {
  return claims.map((claim) => {
    const evidence = evidenceByClaimId[claim.id] ?? [];
    const sourceReports: SourceReport[] = evidence.map((e) => {
      const src = approvedSourceById(e.sourceId);
      const stanceMap = {
        support: "support" as const,
        contradict: "dispute" as const,
        neutral: "neutral" as const,
      };
      return {
        sourceId: e.sourceId,
        sourceName: e.sourceName ?? src?.name ?? e.sourceId,
        stance: stanceMap[e.stance],
        excerpt: e.excerpt,
        url: e.url,
        prominence: "body" as const,
      };
    });

    const supportCount = evidence.filter((e) => e.stance === "support").length;
    const agreementScore =
      evidence.length === 0 ? 0 : Math.round((supportCount / evidence.length) * 100);

    return {
      claimId: claim.id,
      claimText: claim.text,
      sourceReports,
      agreementScore,
      contradictions: [],
    };
  });
}
