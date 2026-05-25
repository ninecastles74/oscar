import type { ApiProviderId, NewsArticle, StoryCluster } from "@/types/news-platform";
import { saveClusterArticles } from "../consensus/store";
import { clusterArticles } from "./cluster";
import { deduplicateArticles } from "./dedupe";
import { rankTopClusters } from "./rank";
import { fetchAllProviders, type ProviderErrorRecord } from "./providers";
import type { ProviderFetchResult } from "./providers/types";
import type { DedupeStats } from "./dedupe";
import type { ClusterStats } from "./cluster";
import type { RankStats } from "./rank";

export interface IngestNewsOptions {
  providers?: ApiProviderId[];
  country?: string;
  language?: string;
  maxArticlesPerProvider?: number;
  topN?: number;
}

export interface IngestNewsResult {
  articles: NewsArticle[];
  clusters: StoryCluster[];
  top100: StoryCluster[];
  providerResults: ProviderFetchResult[];
  errors: ProviderErrorRecord[];
  stats: {
    fetched: number;
    afterDedupe: number;
    clusterCount: number;
    top100Count: number;
    dedupe: DedupeStats;
    cluster: ClusterStats;
    rank: RankStats;
  };
  ingestedAt: string;
}

/**
 * Full server-side ingestion pipeline:
 * fetch → normalize (per provider) → dedupe → cluster → rank top 100.
 */
export async function ingestNews(options: IngestNewsOptions = {}): Promise<IngestNewsResult> {
  const { results: providerResults, errors } = await fetchAllProviders({
    providers: options.providers,
    country: options.country,
    language: options.language,
    maxArticles: options.maxArticlesPerProvider,
  });

  const allArticles = providerResults.flatMap((r) => r.articles);
  const fetched = allArticles.length;

  const { unique, stats: dedupeStats } = deduplicateArticles(allArticles);
  const { clusters, articles: clusteredArticles, stats: clusterStats } = clusterArticles(unique);
  const { top100, stats: rankStats } = rankTopClusters(
    clusters,
    clusteredArticles,
    options.topN ?? 100,
  );

  for (const cluster of clusters) {
    const members = clusteredArticles.filter((a) => a.clusterId === cluster.id);
    if (members.length >= 1) {
      saveClusterArticles(cluster.id, members);
    }
  }

  return {
    articles: clusteredArticles,
    clusters,
    top100,
    providerResults,
    errors,
    stats: {
      fetched,
      afterDedupe: dedupeStats.output,
      clusterCount: clusterStats.clusterCount,
      top100Count: rankStats.top100Count,
      dedupe: dedupeStats,
      cluster: clusterStats,
      rank: rankStats,
    },
    ingestedAt: new Date().toISOString(),
  };
}
