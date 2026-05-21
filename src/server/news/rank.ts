import type { NewsArticle, StoryCluster } from "@/types/news-platform";
import { reliabilityForDomain } from "./source-registry";
import { extractDomain } from "./utils/url";

const TOP_N = 100;
const RECENCY_HALF_LIFE_HOURS = 12;
const VELOCITY_WINDOW_HOURS = 6;

function recencyScore(publishedAt: string, nowMs: number): number {
  const ageHours = (nowMs - new Date(publishedAt).getTime()) / 3_600_000;
  if (ageHours < 0) return 1;
  return Math.exp((-ageHours * Math.LN2) / RECENCY_HALF_LIFE_HOURS);
}

function sourceImportanceScore(articles: NewsArticle[]): number {
  if (articles.length === 0) return 0;
  const sum = articles.reduce((acc, a) => acc + reliabilityForDomain(a.sourceDomain), 0);
  return sum / articles.length / 100;
}

function sourceDiversityScore(articles: NewsArticle[]): number {
  const domains = new Set(articles.map((a) => extractDomain(a.sourceDomain)));
  const unique = domains.size;
  const total = articles.length;
  return Math.min(1, unique / Math.max(1, Math.log2(total + 1)));
}

function velocityScore(articles: NewsArticle[], nowMs: number): number {
  const windowMs = VELOCITY_WINDOW_HOURS * 3_600_000;
  const recent = articles.filter((a) => nowMs - new Date(a.publishedAt).getTime() <= windowMs);
  if (recent.length <= 1) return recent.length * 0.15;
  const spanHours =
    (Math.max(...recent.map((a) => new Date(a.publishedAt).getTime())) -
      Math.min(...recent.map((a) => new Date(a.publishedAt).getTime()))) /
      3_600_000 || 1;
  const rate = recent.length / Math.max(spanHours, 0.5);
  return Math.min(1, rate / 5);
}

export interface RankedCluster extends StoryCluster {
  rankScore: number;
  rankBreakdown: {
    recency: number;
    sourceImportance: number;
    sourceDiversity: number;
    velocity: number;
  };
}

export interface RankStats {
  totalClusters: number;
  top100Count: number;
}

/**
 * Rank story clusters for Top 100: recency, source importance, source count/diversity, velocity.
 */
export function rankTopClusters(
  clusters: StoryCluster[],
  articles: NewsArticle[],
  limit = TOP_N,
): { ranked: RankedCluster[]; top100: StoryCluster[]; stats: RankStats } {
  const nowMs = Date.now();
  const byCluster = new Map<string, NewsArticle[]>();
  for (const a of articles) {
    if (!a.clusterId) continue;
    const list = byCluster.get(a.clusterId) ?? [];
    list.push(a);
    byCluster.set(a.clusterId, list);
  }

  const ranked: RankedCluster[] = clusters.map((cluster) => {
    const members = byCluster.get(cluster.id) ?? [];
    const recency = recencyScore(cluster.publishedAt, nowMs);
    const importance = sourceImportanceScore(members);
    const diversity = sourceDiversityScore(members);
    const velocity = velocityScore(members, nowMs);

    const rankScore = 0.35 * recency + 0.25 * importance + 0.25 * diversity + 0.15 * velocity;

    return {
      ...cluster,
      trendingScore: Math.round(rankScore * 1000) / 10,
      rankScore,
      rankBreakdown: {
        recency,
        sourceImportance: importance,
        sourceDiversity: diversity,
        velocity,
      },
    };
  });

  ranked.sort((a, b) => b.rankScore - a.rankScore);
  const top = ranked.slice(0, limit);
  const top100: StoryCluster[] = top.map(
    ({ rankScore: _r, rankBreakdown: _b, ...cluster }) => cluster,
  );

  return {
    ranked: top,
    top100,
    stats: {
      totalClusters: clusters.length,
      top100Count: top100.length,
    },
  };
}
