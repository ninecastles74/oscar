import type { NewsArticle, StoryCluster, StoryConsensusReport } from "@/types/news-platform";
import { pickClusterImageUrl } from "@/lib/article-image";
import type { AnalyzedArticleBundle } from "../consensus/types";
import { rankTopClusters } from "./rank";
import { saveClusterArticles, saveStoryConsensus, getStoryConsensus } from "../consensus/store";
import type { IngestNewsResult } from "./ingest";
import {
  loadFeedStateFromKv,
  saveFeedStateToKv,
  slimArticleForPersist,
  slimClusterForPersist,
  type PersistedFeedState,
} from "./feed-persist";

const TOP_N = 100;

export interface StoredArticle extends NewsArticle {
  firstSeenAt: string;
  lastSeenAt: string;
  analyzedAt?: string;
  analysisVersion: number;
}

export interface StoredCluster extends StoryCluster {
  firstSeenAt: string;
  lastSeenAt: string;
  enteredFeedAt: string;
  lastAnalyzedAt?: string;
}

export interface FeedMergeResult {
  newArticleIds: string[];
  updatedArticleIds: string[];
  affectedClusterIds: string[];
  evictedClusterIds: string[];
  top100: StoryCluster[];
}

interface FeedState {
  articles: Map<string, StoredArticle>;
  clusters: Map<string, StoredCluster>;
  articleBundles: Map<string, AnalyzedArticleBundle>;
  top100ClusterIds: string[];
  lastIngestAt?: string;
  lastAnalysisAt?: string;
}

const state: FeedState = {
  articles: new Map(),
  clusters: new Map(),
  articleBundles: new Map(),
  top100ClusterIds: [],
};

let hydratePromise: Promise<boolean> | null = null;

function articleKey(article: NewsArticle): string {
  return article.id || article.url;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function hydrateFeedFromSnapshot(snapshot: PersistedFeedState): void {
  state.articles.clear();
  state.clusters.clear();
  state.articleBundles.clear();
  for (const article of snapshot.articles) {
    state.articles.set(article.id, article);
  }
  for (const cluster of snapshot.clusters) {
    state.clusters.set(cluster.id, cluster);
  }
  state.top100ClusterIds = snapshot.top100ClusterIds;
  state.lastIngestAt = snapshot.lastIngestAt;
  state.lastAnalysisAt = snapshot.lastAnalysisAt;
}

export function exportFeedSnapshot(): PersistedFeedState {
  return {
    articles: [...state.articles.values()].map(slimArticleForPersist),
    clusters: [...state.clusters.values()].map(slimClusterForPersist),
    top100ClusterIds: state.top100ClusterIds,
    lastIngestAt: state.lastIngestAt,
    lastAnalysisAt: state.lastAnalysisAt,
  };
}

/** Load Top 100 from KV once per isolate (Workers have no shared RAM between requests). */
export async function ensureFeedHydratedFromKv(): Promise<boolean> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    if (state.top100ClusterIds.length > 0) return true;
    const snapshot = await loadFeedStateFromKv();
    if (!snapshot || snapshot.top100ClusterIds.length === 0) return false;
    hydrateFeedFromSnapshot(snapshot);
    return true;
  })();
  return hydratePromise;
}

async function persistFeedAsync(): Promise<void> {
  await saveFeedStateToKv(exportFeedSnapshot());
}

/** Merge ingest batch into durable feed; rank by date/score; cap visible feed at 100. */
export function mergeIngestIntoFeed(ingest: IngestNewsResult): FeedMergeResult {
  const ts = ingest.ingestedAt || nowIso();
  const newArticleIds: string[] = [];
  const updatedArticleIds: string[] = [];
  const affectedClusterIds = new Set<string>();

  for (const article of ingest.articles) {
    const key = articleKey(article);
    const existing = state.articles.get(key);
    if (!existing) {
      const stored: StoredArticle = {
        ...article,
        id: key,
        firstSeenAt: ts,
        lastSeenAt: ts,
        analysisVersion: 0,
      };
      state.articles.set(key, stored);
      newArticleIds.push(key);
      if (article.clusterId) affectedClusterIds.add(article.clusterId);
    } else {
      state.articles.set(key, {
        ...existing,
        ...article,
        id: key,
        lastSeenAt: ts,
      });
      updatedArticleIds.push(key);
      if (article.clusterId) affectedClusterIds.add(article.clusterId);
    }
  }

  for (const cluster of ingest.clusters) {
    const existing = state.clusters.get(cluster.id);
    const publishedAt = cluster.publishedAt || ts;
    const members = ingest.articles.filter((a) => a.clusterId === cluster.id);
    const imageUrl = pickClusterImageUrl(members) ?? cluster.imageUrl ?? existing?.imageUrl;
    const withImage = imageUrl ? { ...cluster, imageUrl } : cluster;
    if (!existing) {
      state.clusters.set(cluster.id, {
        ...withImage,
        firstSeenAt: ts,
        lastSeenAt: publishedAt,
        enteredFeedAt: ts,
      });
    } else {
      state.clusters.set(cluster.id, {
        ...existing,
        ...withImage,
        lastSeenAt: publishedAt,
      });
    }
    if (members.length >= 2) {
      saveClusterArticles(cluster.id, members);
    }
  }

  const allClusters = [...state.clusters.values()];
  const allArticles = [...state.articles.values()];
  const { top100 } = rankTopClusters(allClusters, allArticles, TOP_N);

  const prevTop = new Set(state.top100ClusterIds);
  const nextTop = top100.map((c) => c.id);
  const evictedClusterIds = [...prevTop].filter((id) => !nextTop.includes(id));

  const feedTs = ts;
  for (const cluster of top100) {
    const stored = state.clusters.get(cluster.id);
    if (stored && !prevTop.has(cluster.id)) {
      state.clusters.set(cluster.id, { ...stored, enteredFeedAt: feedTs });
    }
  }

  state.top100ClusterIds = nextTop;
  state.lastIngestAt = ts;

  void persistFeedAsync();

  return {
    newArticleIds,
    updatedArticleIds,
    affectedClusterIds: [...affectedClusterIds],
    evictedClusterIds,
    top100,
  };
}

export function getUnanalyzedArticleIds(articleIds?: string[]): string[] {
  const ids = articleIds ?? [...state.articles.keys()];
  return ids.filter((id) => {
    const a = state.articles.get(id);
    return a && !a.analyzedAt;
  });
}

export function markArticleAnalyzed(
  articleId: string,
  bundle: AnalyzedArticleBundle,
): void {
  const a = state.articles.get(articleId);
  if (!a) return;
  state.articles.set(articleId, {
    ...a,
    analyzedAt: nowIso(),
    analysisVersion: (a.analysisVersion ?? 0) + 1,
  });
  state.articleBundles.set(articleId, bundle);
}

export function getArticleBundle(articleId: string): AnalyzedArticleBundle | undefined {
  return state.articleBundles.get(articleId);
}

export function getClusterArticlesFromStore(clusterId: string): NewsArticle[] {
  return [...state.articles.values()].filter((a) => a.clusterId === clusterId);
}

export function updateClusterFromConsensus(
  clusterId: string,
  report: StoryConsensusReport,
): void {
  const c = state.clusters.get(clusterId);
  if (!c) return;
  state.clusters.set(clusterId, {
    ...c,
    confidence: report.consensusScore,
    disputedClaims: report.disputedClaims.length,
    missingContext: report.omittedContext.length,
    lastAnalyzedAt: nowIso(),
    summary: report.summary,
  });
  saveStoryConsensus(report);
}

export async function getTop100Clusters(): Promise<StoryCluster[]> {
  await ensureFeedHydratedFromKv();
  return state.top100ClusterIds
    .map((id) => state.clusters.get(id))
    .filter((c): c is StoredCluster => !!c);
}

export function getFeedMeta() {
  return {
    lastIngestAt: state.lastIngestAt,
    lastAnalysisAt: state.lastAnalysisAt,
    totalArticles: state.articles.size,
    totalClusters: state.clusters.size,
    top100Count: state.top100ClusterIds.length,
  };
}

export function setLastAnalysisAt(iso: string): void {
  state.lastAnalysisAt = iso;
}

export function getStoredCluster(clusterId: string): StoredCluster | undefined {
  return state.clusters.get(clusterId);
}

export function getClusterConsensus(clusterId: string): StoryConsensusReport | undefined {
  return getStoryConsensus(clusterId);
}
