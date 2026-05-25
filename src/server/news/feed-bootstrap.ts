import { ingestNews } from "./ingest";
import { getNewsIngestionEnv, isProviderConfigured } from "./env";
import type { ApiProviderId } from "@/types/news-platform";
import {
  acquireBootstrapLock,
  releaseBootstrapLock,
  saveFeedStateToKv,
} from "./feed-persist";
import {
  exportFeedSnapshot,
  getFeedMeta,
  hydrateFeedFromSnapshot,
  mergeIngestIntoFeed,
} from "./feed-store";

export type BootstrapResult = {
  ran: boolean;
  reason: string;
  newArticles?: number;
  top100Count?: number;
  providerErrors?: string[];
};

/** Run ingest when the feed is empty and at least one provider is configured. */
export async function bootstrapFeedIfEmpty(): Promise<BootstrapResult> {
  const meta = getFeedMeta();
  if (meta.top100Count > 0) {
    return { ran: false, reason: "feed_already_has_clusters", top100Count: meta.top100Count };
  }

  const env = getNewsIngestionEnv();
  const configured = env.enabledProviders.filter((p) => isProviderConfigured(p, env));
  if (configured.length === 0) {
    return {
      ran: false,
      reason: "no_providers_configured",
      providerErrors: env.enabledProviders.map(
        (p) => `${p}: not configured (missing API key or RSS registry)`,
      ),
    };
  }

  const locked = await acquireBootstrapLock();
  if (!locked) {
    return { ran: false, reason: "bootstrap_cooldown_active" };
  }

  try {
    const ingest = await ingestNews({
      providers: configured as ApiProviderId[],
      maxArticlesPerProvider: Math.min(env.ingestMaxArticlesPerProvider, 40),
      topN: 100,
    });

    if (ingest.articles.length === 0) {
      const errMsgs = ingest.errors.map((e) => `${e.provider}: ${e.message}`);
      return {
        ran: false,
        reason: "ingest_returned_zero_articles",
        providerErrors: errMsgs,
      };
    }

    const merge = mergeIngestIntoFeed(ingest);
    await saveFeedStateToKv(exportFeedSnapshot());

    return {
      ran: true,
      reason: "ingest_ok",
      newArticles: merge.newArticleIds.length,
      top100Count: merge.top100.length,
      providerErrors: ingest.errors.map((e) => `${e.provider}: ${e.message}`),
    };
  } catch (err) {
    return {
      ran: false,
      reason: err instanceof Error ? err.message : "bootstrap_failed",
    };
  } finally {
    await releaseBootstrapLock();
  }
}
