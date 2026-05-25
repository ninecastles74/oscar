import type { NewsArticle } from "@/types/news-platform";
import type { AuthorDirectoryRow } from "@/types/sources-directory";
import { getArticleScores, getLatestAuthor } from "../reliability/store";
import { stableArticleId } from "../news/utils/text";
import { isValidAuthorByline } from "./author-byline";

/** Apply rolling average + article count from the reliability store when available. */
export function applyStoredAuthorScore(
  row: AuthorDirectoryRow,
  feedArticleCount: number,
): AuthorDirectoryRow {
  const computed = getLatestAuthor(row.authorId);
  if (!computed) {
    return {
      ...row,
      articlesScored: Math.max(row.articlesScored, feedArticleCount),
    };
  }
  return {
    authorId: row.authorId,
    displayName: computed.displayName || row.displayName,
    outlet: row.outlet,
    averageScore: computed.overallScore,
    rollingAverage: computed.rollingAverage,
    articlesScored: Math.max(computed.articlesScored, feedArticleCount),
    scoreSource: "computed",
    trend: computed.trend?.direction ?? null,
  };
}

/** Add or refresh authors discovered via scored feed articles (bylines on bundles). */
export function mergeAuthorsFromScoredArticles(
  rows: AuthorDirectoryRow[],
  articles: NewsArticle[],
): AuthorDirectoryRow[] {
  const map = new Map(rows.map((r) => [r.authorId, { ...r }]));
  const counts = new Map<
    string,
    { displayName: string; outlet: string | null; feedCount: number }
  >();

  for (const article of articles) {
    const key = article.id || stableArticleId(article.url);
    const versions = getArticleScores(key);
    const latest = versions[versions.length - 1];
    const authorId = latest?.authorId;
    if (!authorId) continue;

    const displayName = article.author?.trim() || getLatestAuthor(authorId)?.displayName;
    if (!displayName || !isValidAuthorByline(displayName, article.sourceName)) continue;

    const prev = counts.get(authorId);
    counts.set(authorId, {
      displayName,
      outlet: article.sourceName ?? prev?.outlet ?? null,
      feedCount: (prev?.feedCount ?? 0) + 1,
    });
  }

  for (const [authorId, { displayName, outlet, feedCount }] of counts) {
    const existing = map.get(authorId);
    const base: AuthorDirectoryRow = existing ?? {
      authorId,
      displayName,
      outlet,
      averageScore: 0,
      rollingAverage: null,
      articlesScored: 0,
      scoreSource: "registry",
      trend: null,
    };
    map.set(
      authorId,
      applyStoredAuthorScore(
        {
          ...base,
          displayName: base.displayName || displayName,
          outlet: base.outlet ?? outlet,
        },
        feedCount,
      ),
    );
  }

  return [...map.values()];
}

/** Keep person bylines only; require a published average from analysis or Supabase. */
export function finalizeAuthorDirectoryRows(rows: AuthorDirectoryRow[]): AuthorDirectoryRow[] {
  return rows
    .filter((a) => isValidAuthorByline(a.displayName, a.outlet ?? undefined))
    .filter(
      (a) =>
        a.scoreSource === "computed" ||
        (a.scoreSource === "database" && a.averageScore > 0),
    )
    .sort(
      (a, b) =>
        b.averageScore - a.averageScore ||
        b.articlesScored - a.articlesScored ||
        a.displayName.localeCompare(b.displayName),
    );
}
