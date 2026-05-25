import type { AlignedClaimGroup } from "../claim-alignment";
import type { AnalyzedArticleBundle } from "../types";
import { clampScore } from "../../reliability/utils/math";

/**
 * 0–100: how densely claims are backed by cited evidence across the cluster.
 */
export function computeEvidenceDensityScore(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
): number {
  let totalClaims = 0;
  let claimsWithEvidence = 0;
  let totalEvidenceItems = 0;
  let crossSourceEvidenceGroups = 0;

  for (const art of articles) {
    for (const claim of art.report.claims) {
      totalClaims += 1;
      const count = claim.evidence?.length ?? 0;
      totalEvidenceItems += count;
      if (count > 0) claimsWithEvidence += 1;
    }
  }

  for (const group of alignedGroups) {
    const sourceIds = new Set(group.occurrences.map((o) => o.sourceId));
    if (sourceIds.size >= 2) {
      const withEvidence = group.occurrences.some((o) => {
        const art = articles.find((a) => a.articleId === o.articleId);
        const claim = art?.report.claims.find((c) => c.id === o.claimId);
        return (claim?.evidence?.length ?? 0) > 0;
      });
      if (withEvidence) crossSourceEvidenceGroups += 1;
    }
  }

  if (totalClaims === 0) return 0;

  const coverageRatio = (claimsWithEvidence / totalClaims) * 55;
  const itemsPerClaim = Math.min(30, (totalEvidenceItems / totalClaims) * 8);
  const crossSourceRatio =
    alignedGroups.length > 0
      ? (crossSourceEvidenceGroups / alignedGroups.length) * 15
      : 0;

  return clampScore(Math.round(coverageRatio + itemsPerClaim + crossSourceRatio));
}
