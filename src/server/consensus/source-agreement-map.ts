import type {
  ConsensusArticleRef,
  SourceAgreementCell,
  SourceAgreementMap,
  SourceAgreementStance,
} from "@/types/news-platform";
import type { AlignedClaimGroup, ClaimOccurrence } from "./claim-alignment";
import type { AnalyzedArticleBundle } from "./types";

function stanceFromOccurrence(occ: ClaimOccurrence | undefined): SourceAgreementStance {
  if (!occ) return "absent";
  if (occ.verdict === "supported") return "support";
  if (occ.verdict === "disputed") return "dispute";
  if (occ.verdict === "unclear" || occ.verdict === "insufficient_evidence") return "neutral";
  return "neutral";
}

export function buildSourceAgreementMap(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
  omittedGroupIds: Set<string>,
): SourceAgreementMap {
  const sources: ConsensusArticleRef[] = articles.map((a) => ({
    articleId: a.articleId,
    sourceId: a.sourceId,
    sourceName: a.sourceName,
    sourceDomain: a.sourceDomain,
    title: a.title,
    url: a.url,
    publishedAt: a.publishedAt,
  }));

  const claimGroups = alignedGroups.map((g) => ({
    groupId: g.id,
    canonicalText: g.canonicalText,
  }));

  const cells: SourceAgreementCell[] = [];

  for (const group of alignedGroups) {
    const byArticle = new Map(group.occurrences.map((o) => [o.articleId, o]));
    for (const art of articles) {
      const occ = byArticle.get(art.articleId);
      let stance = stanceFromOccurrence(occ);
      if (!occ && omittedGroupIds.has(group.id)) stance = "omitted";
      cells.push({
        groupId: group.id,
        sourceId: art.sourceId,
        articleId: art.articleId,
        stance,
        confidence: occ?.confidence,
        excerpt: occ?.text.slice(0, 120),
      });
    }
  }

  return { sources, claimGroups, cells };
}
