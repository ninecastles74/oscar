import type { OmittedContextItem } from "@/types/news-platform";
import type { AlignedClaimGroup } from "./claim-alignment";
import type { AnalyzedArticleBundle } from "./types";

export function detectCrossArticleOmittedContext(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
): { items: OmittedContextItem[]; omittedGroupIds: Set<string> } {
  const items: OmittedContextItem[] = [];
  const omittedGroupIds = new Set<string>();
  const allArticleIds = articles.map((a) => a.articleId);

  for (const group of alignedGroups) {
    const presentIds = new Set(group.occurrences.map((o) => o.articleId));
    if (presentIds.size >= articles.length) continue;

    const missing = allArticleIds.filter((id) => !presentIds.has(id));
    if (missing.length === 0) continue;

    const hasContextFlag = group.occurrences.some((o) => {
      const art = articles.find((a) => a.articleId === o.articleId);
      const claim = art?.report.claims.find((c) => c.id === o.claimId);
      return !!claim?.context;
    });

    if (presentIds.size >= 2 || hasContextFlag) {
      omittedGroupIds.add(group.id);
      items.push({
        groupId: group.id,
        claimText: group.canonicalText,
        description: hasContextFlag
          ? "Some outlets omit context that others include for this claim."
          : "Claim appears in subset of coverage; other outlets do not address it.",
        presentInArticleIds: [...presentIds],
        missingFromArticleIds: missing,
        severity: missing.length >= articles.length / 2 ? "warning" : "info",
      });
    }
  }

  for (const art of articles) {
    for (const m of art.results.missingContext) {
      const claim = art.report.claims.find((c) => c.id === m.claimId);
      items.push({
        claimText: claim?.text ?? m.claimId,
        description: m.description,
        presentInArticleIds: [art.articleId],
        missingFromArticleIds: allArticleIds.filter((id) => id !== art.articleId),
        severity: "info",
      });
    }
    for (const c of art.report.claims) {
      if (!c.context) continue;
      items.push({
        claimText: c.text,
        description: c.context,
        presentInArticleIds: [art.articleId],
        missingFromArticleIds: allArticleIds.filter((id) => id !== art.articleId),
        severity: "warning",
      });
    }
  }

  return { items, omittedGroupIds };
}
