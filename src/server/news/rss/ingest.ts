import type { NewsIngestionEnv } from "../env";
import { IngestionError } from "../errors";
import { normalizeArticles } from "../normalize";
import { fetchWithRateLimit } from "../providers/http";
import type { ProviderContext, ProviderFetchResult, RawArticle } from "../providers/types";
import { extractClaimsFromRssSummary } from "./claims";
import { sanitizeRssSummary } from "./content-policy";
import { capItemsPerFeed, interleaveFeedBuckets, perFeedArticleLimit } from "./collect-registry-items";
import { parseFeedXml } from "./parser";
import type { PublisherFeedConfig } from "../env";
import { loadRssFeedRegistry, type RssFeedRegistryEntry } from "./registry";

export function publisherFeedToRegistryEntry(feed: PublisherFeedConfig): RssFeedRegistryEntry {
  return {
    id: feed.id,
    name: feed.name,
    domain: feed.domain,
    feedUrl: feed.feedUrl,
    sourceId: feed.id,
    category: (feed.category as RssFeedRegistryEntry["category"]) ?? "General",
    language: feed.language ?? "en",
    reliability: feed.reliability ?? 55,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 25,
  };
}

export function rssItemsToRaw(
  items: ReturnType<typeof parseFeedXml>,
  feed: ReturnType<typeof loadRssFeedRegistry>[number],
): RawArticle[] {
  return items.map((item) => {
    const { summary, summarySource } = sanitizeRssSummary(item.description, item.title);
    const claims = extractClaimsFromRssSummary(summary, item.title);

    return {
      externalId: item.externalId,
      title: item.title,
      description: summary,
      url: item.link,
      sourceName: feed.name,
      sourceDomain: feed.domain,
      author: item.author,
      publishedAt: item.publishedAt,
      imageUrl: item.imageUrl,
      category: item.category,
      language: feed.language,
      country: feed.country,
      provider: "rss",
      feedId: feed.id,
      feedUrl: feed.feedUrl,
      summarySource,
      imageSource: item.imageSource,
      contentPolicy: feed.contentPolicy,
      allowFullText: feed.contentPolicy === "licensed_full_text",
      extractedClaims: claims,
      sourceId: feed.sourceId,
    };
  });
}

export async function fetchRssFromRegistry(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  const provider = "rss" as const;
  const registry = loadRssFeedRegistry(env.rssFeedUrls);

  if (registry.length === 0) {
    throw new IngestionError({
      code: "PROVIDER_DISABLED",
      provider,
      message:
        "No RSS feeds enabled. Set RSS_USE_DEFAULT_REGISTRY=true, RSS_ENABLED_FEED_IDS, RSS_FEEDS_JSON, or RSS_FEED_URLS.",
    });
  }

  const start = Date.now();
  const buckets = new Map<string, RawArticle[]>();
  const errors: string[] = [];
  const feedsSucceeded: string[] = [];

  for (const feed of registry) {
    const perFeedMax = perFeedArticleLimit(registry.length, ctx.maxArticles, feed);
    try {
      const res = await fetchWithRateLimit(`${provider}:${feed.id}`, feed.feedUrl, env, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
          "User-Agent": "OscarNewsBot/1.0 (+https://oscar.local)",
        },
      });
      const xml = await res.text();
      const items = parseFeedXml(xml, feed);
      const raw = capItemsPerFeed(rssItemsToRaw(items, feed), perFeedMax);
      if (raw.length > 0) {
        buckets.set(feed.id, raw);
        feedsSucceeded.push(feed.id);
      } else {
        errors.push(`${feed.id}: feed returned zero items`);
      }
    } catch (err) {
      const msg =
        err instanceof IngestionError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      errors.push(`${feed.id}: ${msg}`);
    }
  }

  if (buckets.size === 0 && errors.length > 0) {
    throw new IngestionError({
      code: "PARSE_ERROR",
      provider,
      message: `All RSS feeds failed: ${errors.join("; ")}`,
    });
  }

  const merged = interleaveFeedBuckets(buckets, ctx.maxArticles);
  const articles = await normalizeArticles(merged);

  if (errors.length > 0) {
    console.warn(
      `[rss-ingest] ${feedsSucceeded.length}/${registry.length} feeds OK; failures: ${errors.join("; ")}`,
    );
  }

  return {
    provider,
    articles,
    fetched: merged.length,
    skipped: merged.length - articles.length,
    durationMs: Date.now() - start,
    warnings: errors.length > 0 ? errors : undefined,
  };
}

export function getRssRegistrySummary(env: NewsIngestionEnv) {
  const feeds = loadRssFeedRegistry(env.rssFeedUrls);
  return {
    count: feeds.length,
    feeds: feeds.map((f) => ({
      id: f.id,
      name: f.name,
      domain: f.domain,
      feedUrl: f.feedUrl,
      category: f.category,
      contentPolicy: f.contentPolicy,
      includeImage: f.includeImage,
    })),
  };
}
