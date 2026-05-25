import type { NewsArticle } from "@/types/news-platform";
import type { AuthorDirectoryRow, OrganizationDirectoryRow } from "@/types/sources-directory";
import { APPROVED_SOURCES } from "../analysis/sources";
import { authorIdFromName, organizationIdFromDomain } from "../reliability/utils/entity-ids";
import { resolvePublisher } from "../news/resolve-publisher";

/** Merge live feed articles into the public Sources directory (orgs + bylines). */
export function mergeFeedIntoSourcesDirectory(
  organizations: OrganizationDirectoryRow[],
  authors: AuthorDirectoryRow[],
  articles: NewsArticle[],
): { organizations: OrganizationDirectoryRow[]; authors: AuthorDirectoryRow[]; feedOrgCount: number; feedAuthorCount: number } {
  if (!articles.length) {
    return { organizations, authors, feedOrgCount: 0, feedAuthorCount: 0 };
  }

  const orgMap = new Map(organizations.map((o) => [o.organizationId, { ...o }]));
  const authorMap = new Map(authors.map((a) => [a.authorId, { ...a }]));
  const orgFeedCount = new Map<string, number>();
  const authorFeedCount = new Map<string, number>();
  let feedOrgCount = 0;
  let feedAuthorCount = 0;

  for (const article of articles) {
    const pub = resolvePublisher({
      sourceId: article.sourceId,
      sourceDomain: article.sourceDomain,
      sourceName: article.sourceName,
      url: article.url,
    });
    const organizationId = organizationIdFromDomain(pub.sourceDomain);
    orgFeedCount.set(organizationId, (orgFeedCount.get(organizationId) ?? 0) + 1);

    const registry = APPROVED_SOURCES.find((s) => s.id === pub.sourceId);
    const existingOrg = orgMap.get(organizationId);
    if (existingOrg) {
      const feedCount = orgFeedCount.get(organizationId) ?? 0;
      if (existingOrg.articlesScored === 0 && feedCount > 0) {
        orgMap.set(organizationId, { ...existingOrg, articlesScored: feedCount });
      }
    } else {
      feedOrgCount += 1;
      orgMap.set(organizationId, {
        sourceId: pub.sourceId,
        organizationId,
        name: pub.sourceName,
        domain: pub.sourceDomain,
        bias: registry?.bias ?? "unknown",
        approved: registry?.approved ?? true,
        averageScore: registry?.reliability ?? 0,
        rollingAverage: null,
        articlesScored: orgFeedCount.get(organizationId) ?? 1,
        scoreSource: "registry",
        trend: null,
      });
    }

    const byline = article.author?.trim();
    if (!byline) continue;
    const authorId = authorIdFromName(byline);
    if (!authorId) continue;
    authorFeedCount.set(authorId, (authorFeedCount.get(authorId) ?? 0) + 1);

    const existingAuthor = authorMap.get(authorId);
    if (existingAuthor) {
      const count = authorFeedCount.get(authorId) ?? 0;
      authorMap.set(authorId, {
        ...existingAuthor,
        outlet: existingAuthor.outlet ?? pub.sourceName,
        articlesScored: Math.max(existingAuthor.articlesScored, count),
      });
    } else {
      feedAuthorCount += 1;
      authorMap.set(authorId, {
        authorId,
        displayName: byline,
        outlet: pub.sourceName,
        averageScore: 0,
        rollingAverage: null,
        articlesScored: authorFeedCount.get(authorId) ?? 1,
        scoreSource: "registry",
        trend: null,
      });
    }
  }

  return {
    organizations: [...orgMap.values()].sort((a, b) => b.articlesScored - a.articlesScored || b.averageScore - a.averageScore),
    authors: [...authorMap.values()].sort((a, b) => b.articlesScored - a.articlesScored || a.displayName.localeCompare(b.displayName)),
    feedOrgCount,
    feedAuthorCount,
  };
}
