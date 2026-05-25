import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ApiProviderId } from "@/types/news-platform";
import { ingestNews, type IngestNewsResult } from "./ingest";
import { getNewsIngestionEnv, isProviderConfigured } from "./env";
import { getRssRegistrySummary } from "./rss/ingest";
import {
  getClusterArticlesFromStore,
  getTop100Clusters,
  getFeedMeta,
  getStoredCluster,
} from "./feed-store";
import { MAJOR_US_WORLD_SOURCES } from "./major-publishers";
import { runScheduledNewsPipeline } from "../jobs/news/scheduled-pipeline";
import { bootstrapFeedIfEmpty } from "./feed-bootstrap";
import { feedKvStatus } from "./feed-persist";
import {
  isScheduledNewsEnabled,
  scheduledIngestCron,
} from "../analysis/context";

const providerIdSchema = z.enum(["newsapi", "gnews", "guardian", "nyt", "rss", "publishers"]);

const ingestInputSchema = z
  .object({
    cronSecret: z.string().optional(),
    providers: z.array(providerIdSchema).optional(),
    country: z.string().length(2).optional(),
    language: z.string().min(2).max(5).optional(),
    maxArticlesPerProvider: z.number().int().min(1).max(200).optional(),
    topN: z.number().int().min(1).max(100).optional(),
  })
  .optional();

/** Run the full ingestion pipeline (server-only; API keys never sent to client). */
export const runNewsIngestion = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ingestInputSchema.parse(data))
  .handler(async ({ data }): Promise<IngestNewsResult> => {
    const expected = process.env.CRON_SECRET?.trim();
    if (expected && data?.cronSecret !== expected) {
      throw new Error("Unauthorized: scheduled ingest only (invalid CRON_SECRET).");
    }
    return ingestNews({
      providers: data?.providers as ApiProviderId[] | undefined,
      country: data?.country,
      language: data?.language,
      maxArticlesPerProvider: data?.maxArticlesPerProvider,
      topN: data?.topN,
    });
  });

/** List which providers are configured (keys present) without exposing secrets. */
export const getIngestionProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const env = getNewsIngestionEnv();
  const providers: ApiProviderId[] = ["newsapi", "gnews", "guardian", "rss", "publishers"];

  const rssRegistry = getRssRegistrySummary(env);

  return {
    enabled: env.enabledProviders,
    configured: Object.fromEntries(
      providers.map((p) => [p, isProviderConfigured(p, env)]),
    ) as Record<ApiProviderId, boolean>,
    rss: rssRegistry,
    legacyRssUrlCount: env.rssFeedUrls.length,
    publisherFeedCount: env.publisherFeeds.length,
    rateLimits: env.rateLimits,
  };
});

/** List configured RSS feeds (no secrets). */
export const listRssFeeds = createServerFn({ method: "GET" }).handler(async () => {
  const env = getNewsIngestionEnv();
  return getRssRegistrySummary(env);
});

/** Top 100 story clusters from the live feed (newest ranked; max 100 slots). */
export const getTop100Feed = createServerFn({ method: "GET" }).handler(async () => {
  let bootstrap: Awaited<ReturnType<typeof bootstrapFeedIfEmpty>> | undefined;
  let clusters = await getTop100Clusters();
  if (clusters.length === 0) {
    bootstrap = await bootstrapFeedIfEmpty();
    clusters = await getTop100Clusters();
  }
  const meta = getFeedMeta();
  return {
    clusters,
    meta,
    bootstrap,
    majorSources: MAJOR_US_WORLD_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      reliability: s.reliability,
      bias: s.bias,
    })),
  };
});

/** Diagnostics for news ingest / feed (no secrets). */
export const getNewsFeedDiagnostics = createServerFn({ method: "GET" }).handler(async () => {
  const env = getNewsIngestionEnv();
  const providers: ApiProviderId[] = ["newsapi", "gnews", "guardian", "rss", "publishers"];
  const configured = providers.filter((p) => isProviderConfigured(p, env));
  const meta = getFeedMeta();
  const kv = feedKvStatus();

  return {
    scheduledNewsEnabled: isScheduledNewsEnabled(),
    scheduledIngestCron: scheduledIngestCron(),
    wranglerNewsCron: "0 */8 * * *",
    cronMustMatchEnv:
      "SCHEDULED_NEWS_CRON must match wrangler.jsonc crons or be unset (defaults to 0 */8 * * *).",
    feedStorage: kv.storage,
    feedKvBound: kv.configured,
    feedMeta: meta,
    enabledProviders: env.enabledProviders,
    configuredProviders: configured,
    missingConfiguration: env.enabledProviders
      .filter((p) => !isProviderConfigured(p, env))
      .map((p) => {
        if (p === "rss") {
          return "rss: set RSS_USE_DEFAULT_REGISTRY=true (text var) and/or add API keys for newsapi/gnews/guardian";
        }
        return `${p}: add ${p === "newsapi" ? "NEWS_API_KEY" : p === "gnews" ? "GNEWS_API_KEY" : p === "guardian" ? "GUARDIAN_API_KEY" : p} secret in Cloudflare`;
      }),
    rss: getRssRegistrySummary(env),
    recommendations: [
      !kv.configured
        ? "Create KV namespace FEED_KV and add binding in wrangler.jsonc (see docs/CLOUDFLARE_NEWS_SETUP.md)."
        : null,
      configured.length === 0
        ? "Enable at least one provider: NEWS_INGEST_ENABLED_PROVIDERS=rss plus RSS_USE_DEFAULT_REGISTRY=true, or add NEWS_API_KEY / GNEWS_API_KEY / GUARDIAN_API_KEY secrets."
        : null,
      meta.top100Count === 0
        ? "Visit /stories once after deploy to trigger bootstrap ingest, or wait for the 8h cron."
        : null,
    ].filter(Boolean),
  };
});

/** Run 8h scheduled ingest + incremental heavyweight analysis (requires CRON_SECRET if set). */
export const runScheduledNewsRefresh = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ cronSecret: z.string().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const expected = process.env.CRON_SECRET?.trim();
    if (expected && data?.cronSecret !== expected) {
      throw new Error("Unauthorized: invalid CRON_SECRET");
    }
    return runScheduledNewsPipeline();
  });

/** Single cluster from live feed. */
export const getFeedCluster = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ clusterId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const cluster = getStoredCluster(data.clusterId);
    if (!cluster) return { error: { code: "NOT_FOUND", message: "Cluster not in feed" } };
    return { cluster };
  });

/** Cluster plus member articles (includes image URLs from APIs/RSS). */
export const getFeedClusterDetail = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ clusterId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const cluster = getStoredCluster(data.clusterId);
    if (!cluster) return { error: { code: "NOT_FOUND", message: "Cluster not in feed" } };
    const articles = getClusterArticlesFromStore(data.clusterId);
    return { cluster, articles };
  });
