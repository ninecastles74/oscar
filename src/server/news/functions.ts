import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ApiProviderId } from "@/types/news-platform";
import { ingestNews, type IngestNewsResult } from "./ingest";
import { getNewsIngestionEnv, isProviderConfigured } from "./env";
import { getRssRegistrySummary } from "./rss/ingest";

const providerIdSchema = z.enum(["newsapi", "gnews", "guardian", "nyt", "rss", "publishers"]);

const ingestInputSchema = z
  .object({
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
