import type { StoryCluster } from "@/types/news-platform";
import { getFeedKv, isFeedKvConfigured } from "./worker-env";
import type { StoredArticle, StoredCluster } from "./feed-store";

const FEED_STATE_KEY = "oscar:feed:state:v1";
const BOOTSTRAP_LOCK_KEY = "oscar:feed:bootstrap-lock:v1";
const BOOTSTRAP_COOLDOWN_SEC = 900; // 15 min between auto-ingest attempts

export interface PersistedFeedState {
  articles: StoredArticle[];
  clusters: StoredCluster[];
  top100ClusterIds: string[];
  lastIngestAt?: string;
  lastAnalysisAt?: string;
}

export function exportFeedState(input: {
  articles: Map<string, StoredArticle>;
  clusters: Map<string, StoredCluster>;
  top100ClusterIds: string[];
  lastIngestAt?: string;
  lastAnalysisAt?: string;
}): PersistedFeedState {
  return {
    articles: [...input.articles.values()],
    clusters: [...input.clusters.values()],
    top100ClusterIds: input.top100ClusterIds,
    lastIngestAt: input.lastIngestAt,
    lastAnalysisAt: input.lastAnalysisAt,
  };
}

export async function loadFeedStateFromKv(): Promise<PersistedFeedState | null> {
  const kv = getFeedKv();
  if (!kv) return null;
  try {
    const raw = await kv.get(FEED_STATE_KEY, "json");
    if (!raw || typeof raw !== "object") return null;
    const state = raw as PersistedFeedState;
    if (!Array.isArray(state.articles) || !Array.isArray(state.clusters)) return null;
    if (!Array.isArray(state.top100ClusterIds)) return null;
    return state;
  } catch (err) {
    console.error("[feed-persist] KV load failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function saveFeedStateToKv(state: PersistedFeedState): Promise<boolean> {
  const kv = getFeedKv();
  if (!kv) return false;
  try {
    await kv.put(FEED_STATE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error("[feed-persist] KV save failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Prevent concurrent bootstraps across isolates (best-effort). */
export async function acquireBootstrapLock(): Promise<boolean> {
  const kv = getFeedKv();
  if (!kv) return true;
  try {
    const existing = await kv.get(BOOTSTRAP_LOCK_KEY);
    if (existing) return false;
    await kv.put(BOOTSTRAP_LOCK_KEY, new Date().toISOString(), {
      expirationTtl: BOOTSTRAP_COOLDOWN_SEC,
    });
    return true;
  } catch {
    return true;
  }
}

export async function releaseBootstrapLock(): Promise<void> {
  const kv = getFeedKv();
  if (!kv) return;
  try {
    await kv.delete(BOOTSTRAP_LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** Trim payload for KV size limits — keep fields needed for Top 100 UI. */
export function slimClusterForPersist(c: StoredCluster): StoredCluster {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    category: c.category,
    confidence: c.confidence,
    disputedClaims: c.disputedClaims,
    missingContext: c.missingContext,
    trendingScore: c.trendingScore,
    sourceDiversity: c.sourceDiversity,
    publishedAt: c.publishedAt,
    imageUrl: c.imageUrl,
    firstSeenAt: c.firstSeenAt,
    lastSeenAt: c.lastSeenAt,
    enteredFeedAt: c.enteredFeedAt,
    lastAnalyzedAt: c.lastAnalyzedAt,
  } as StoredCluster;
}

export function slimArticleForPersist(a: StoredArticle): StoredArticle {
  return {
    ...a,
    claims: a.claims ?? [],
  };
}

export function feedKvStatus(): { configured: boolean; storage: "kv" | "memory" } {
  return {
    configured: isFeedKvConfigured(),
    storage: isFeedKvConfigured() ? "kv" : "memory",
  };
}
