import type { NewsIngestionEnv } from "../env";
import { IngestionError } from "../errors";
import { normalizeArticles } from "../normalize";
import { publisherFeedToRegistryEntry, rssItemsToRaw } from "../rss/ingest";
import { parseFeedXml } from "../rss/parser";
import { fetchWithRateLimit } from "./http";
import type { ProviderContext, ProviderFetchResult, RawArticle } from "./types";

export async function fetchPublisherFeeds(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  const provider = "publishers" as const;
  if (env.publisherFeeds.length === 0) {
    throw new IngestionError({
      code: "PROVIDER_DISABLED",
      provider,
      message: "PUBLISHER_FEEDS_JSON is empty",
    });
  }

  const start = Date.now();
  const allRaw: RawArticle[] = [];
  const perFeed = Math.max(5, Math.ceil(ctx.maxArticles / env.publisherFeeds.length));

  for (const pub of env.publisherFeeds) {
    const feed = publisherFeedToRegistryEntry(pub);
    try {
      const res = await fetchWithRateLimit(`${provider}:${feed.id}`, feed.feedUrl, env, {
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      });
      const xml = await res.text();
      const items = parseFeedXml(xml, feed).slice(0, perFeed);
      allRaw.push(...rssItemsToRaw(items, feed));
    } catch (err) {
      if (err instanceof IngestionError) throw err;
      throw new IngestionError({
        code: "PARSE_ERROR",
        provider,
        message: `Failed to fetch publisher feed ${feed.id}`,
        cause: err,
      });
    }
  }

  const articles = await normalizeArticles(allRaw.slice(0, ctx.maxArticles));

  return {
    provider,
    articles,
    fetched: allRaw.length,
    skipped: allRaw.length - articles.length,
    durationMs: Date.now() - start,
  };
}
