import type { NewsArticle } from "@/types/news-platform";
import { canonicalizeUrl, extractDomain, urlsLikelySame } from "./utils/url";
import { titleSimilarity } from "./utils/text";
import { reliabilityForDomain } from "./source-registry";

export interface DedupeStats {
  input: number;
  output: number;
  removedByUrl: number;
  removedByTitleDomain: number;
  removedByTitleCrossDomain: number;
}

const SAME_DOMAIN_TITLE_THRESHOLD = 0.88;
const CROSS_DOMAIN_TITLE_THRESHOLD = 0.93;
const MAX_HOURS_APART_CROSS_DOMAIN = 48;

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

function pickKeeper(a: NewsArticle, b: NewsArticle): NewsArticle {
  const ra = reliabilityForDomain(a.sourceDomain);
  const rb = reliabilityForDomain(b.sourceDomain);
  if (ra !== rb) return ra > rb ? a : b;
  return new Date(a.publishedAt).getTime() >= new Date(b.publishedAt).getTime() ? a : b;
}

/**
 * Deduplicate articles by canonical URL, then title similarity within domain,
 * then high title similarity across domains within a time window.
 */
export function deduplicateArticles(articles: NewsArticle[]): {
  unique: NewsArticle[];
  stats: DedupeStats;
} {
  const stats: DedupeStats = {
    input: articles.length,
    output: 0,
    removedByUrl: 0,
    removedByTitleDomain: 0,
    removedByTitleCrossDomain: 0,
  };

  if (articles.length === 0) {
    stats.output = 0;
    return { unique: [], stats };
  }

  const byCanonical = new Map<string, NewsArticle>();
  for (const article of articles) {
    const key = canonicalizeUrl(article.url);
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, { ...article, url: key });
      continue;
    }
    stats.removedByUrl += 1;
    byCanonical.set(key, pickKeeper(existing, article));
  }

  let pool = [...byCanonical.values()];

  const domainGroups = new Map<string, NewsArticle[]>();
  for (const a of pool) {
    const d = extractDomain(a.sourceDomain);
    const list = domainGroups.get(d) ?? [];
    list.push(a);
    domainGroups.set(d, list);
  }

  const keptIds = new Set<string>();
  for (const group of domainGroups.values()) {
    const sorted = [...group].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
    const survivors: NewsArticle[] = [];
    for (const candidate of sorted) {
      const dup = survivors.some(
        (s) =>
          titleSimilarity(s.title, candidate.title) >= SAME_DOMAIN_TITLE_THRESHOLD ||
          urlsLikelySame(s.url, candidate.url),
      );
      if (dup) {
        stats.removedByTitleDomain += 1;
        continue;
      }
      survivors.push(candidate);
    }
    for (const s of survivors) keptIds.add(s.id);
  }

  pool = pool.filter((a) => keptIds.has(a.id));

  const crossSurvivors: NewsArticle[] = [];
  const crossSorted = [...pool].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  for (const candidate of crossSorted) {
    const dup = crossSurvivors.some((s) => {
      if (extractDomain(s.sourceDomain) === extractDomain(candidate.sourceDomain)) return false;
      if (hoursBetween(s.publishedAt, candidate.publishedAt) > MAX_HOURS_APART_CROSS_DOMAIN)
        return false;
      return titleSimilarity(s.title, candidate.title) >= CROSS_DOMAIN_TITLE_THRESHOLD;
    });
    if (dup) {
      stats.removedByTitleCrossDomain += 1;
      continue;
    }
    crossSurvivors.push(candidate);
  }

  const unique = crossSurvivors.map((a) => ({ ...a, isDuplicate: false }));
  stats.output = unique.length;
  return { unique, stats };
}
