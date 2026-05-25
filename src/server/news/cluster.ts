import type { Category, NewsArticle, StoryCluster } from "@/types/news-platform";
import { pickClusterImageUrl } from "@/lib/article-image";
import { titleSimilarity } from "./utils/text";
import { reliabilityForDomain } from "./source-registry";
import { extractDomain } from "./utils/url";
import { dominantCategoryFromArticles } from "./category-inference";

export interface ClusterStats {
  clusterCount: number;
  largestCluster: number;
  avgClusterSize: number;
}

const CLUSTER_TITLE_THRESHOLD = 0.72;
const MAX_CLUSTER_HOURS = 72;

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(i: number, j: number): void {
    const ri = this.find(i);
    const rj = this.find(j);
    if (ri !== rj) this.parent[ri] = rj;
  }
}

function hoursBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

function pickClusterLead(members: NewsArticle[]): NewsArticle | undefined {
  if (!members.length) return undefined;
  return [...members].sort((a, b) => {
    const rb = reliabilityForDomain(b.sourceDomain) - reliabilityForDomain(a.sourceDomain);
    if (rb !== 0) return rb;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  })[0];
}

export function enrichClusterFromMembers(cluster: StoryCluster, members: NewsArticle[]): StoryCluster {
  const lead = pickClusterLead(members);
  const { primarySourceName, sourceNames } = uniqueSourceLabels(members, lead);
  return {
    ...cluster,
    category: members.length ? dominantCategoryFromArticles(members) : cluster.category,
    primarySourceName: primarySourceName || cluster.primarySourceName,
    sourceNames: sourceNames.length ? sourceNames : cluster.sourceNames,
    storyCount: members.length || cluster.storyCount,
  };
}

function uniqueSourceLabels(
  members: NewsArticle[],
  lead?: NewsArticle,
): { primarySourceName: string; sourceNames: string[] } {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    const label = m.sourceName?.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    names.push(label);
  }
  return {
    primarySourceName: lead?.sourceName?.trim() || names[0] || members[0]?.sourceName || "Unknown",
    sourceNames: names,
  };
}

function buildSummary(articles: NewsArticle[]): string {
  const lead = articles.find((a) => a.description.length > 40) ?? articles[0];
  return lead.description.slice(0, 280);
}

/**
 * Group articles about the same event using title similarity and publication time.
 */
export function clusterArticles(articles: NewsArticle[]): {
  clusters: StoryCluster[];
  articles: NewsArticle[];
  stats: ClusterStats;
} {
  if (articles.length === 0) {
    return {
      clusters: [],
      articles: [],
      stats: { clusterCount: 0, largestCluster: 0, avgClusterSize: 0 },
    };
  }

  const n = articles.length;
  const uf = new UnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hoursBetween(articles[i].publishedAt, articles[j].publishedAt) > MAX_CLUSTER_HOURS)
        continue;
      const sim = titleSimilarity(articles[i].title, articles[j].title);
      if (sim >= CLUSTER_TITLE_THRESHOLD) uf.union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const g = groups.get(root) ?? [];
    g.push(i);
    groups.set(root, g);
  }

  const clusters: StoryCluster[] = [];
  const updatedArticles = [...articles];
  let clusterIdx = 0;

  for (const indices of groups.values()) {
    const members = indices.map((i) => articles[i]);
    const clusterId = `cl_${++clusterIdx}`;

    const sorted = [...members].sort((a, b) => {
      const rb = reliabilityForDomain(b.sourceDomain) - reliabilityForDomain(a.sourceDomain);
      if (rb !== 0) return rb;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    const lead = sorted[0];
    const domains = new Set(members.map((m) => extractDomain(m.sourceDomain)));
    const latest = members.reduce(
      (max, m) => (new Date(m.publishedAt) > new Date(max) ? m.publishedAt : max),
      members[0].publishedAt,
    );

    const articleIds = members.map((m) => m.id);
    for (const idx of indices) {
      updatedArticles[idx] = { ...updatedArticles[idx], clusterId };
    }

    const sourceDiversity = domains.size / Math.max(1, members.length);
    const { primarySourceName, sourceNames } = uniqueSourceLabels(members, lead);

    clusters.push({
      id: clusterId,
      title: lead.title,
      summary: buildSummary(members),
      category: dominantCategoryFromArticles(members),
      primarySourceName,
      sourceNames,
      storyCount: members.length,
      confidence: Math.min(
        95,
        Math.round(50 + sourceDiversity * 40 + Math.min(members.length, 5) * 4),
      ),
      disputedClaims: 0,
      missingContext: 0,
      publishedAt: latest,
      imageUrl: pickClusterImageUrl(members, lead),
      articleIds,
      storyIds: articleIds,
      claimIds: [],
      trendingScore: 0,
      sourceDiversity,
      geographicScope: members.map((m) => m.country).filter((c): c is string => !!c),
    });
  }

  const sizes = clusters.map((c) => c.storyCount);
  const stats: ClusterStats = {
    clusterCount: clusters.length,
    largestCluster: Math.max(0, ...sizes),
    avgClusterSize: sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0,
  };

  return { clusters, articles: updatedArticles, stats };
}
