import type { ArticleContentPolicy, Category } from "@/types/news-platform";
import { MAJOR_US_WORLD_RSS_FEEDS } from "../major-publishers";

export interface RssFeedRegistryEntry {
  id: string;
  name: string;
  domain: string;
  feedUrl: string;
  sourceId: string;
  category: Category;
  language: string;
  country?: string;
  reliability: number;
  enabled: boolean;
  /** Store only feed summary, never full HTML body (default). */
  contentPolicy: ArticleContentPolicy;
  /** Include media:thumbnail / enclosure images when present in feed. */
  includeImage: boolean;
  maxItemsPerFetch: number;
}

function readString(key: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env[key] : undefined;
  return v?.trim() || undefined;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

/** Major publisher feeds — public RSS endpoints; summaries only unless licensed elsewhere. */
export const DEFAULT_RSS_FEED_REGISTRY: RssFeedRegistryEntry[] = [
  {
    id: "bbc-top",
    name: "BBC News",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/news/rss.xml",
    sourceId: "s3",
    category: "World",
    language: "en",
    country: "GB",
    reliability: 92,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 25,
  },
  {
    id: "bbc-business",
    name: "BBC Business",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
    sourceId: "s3",
    category: "Business",
    language: "en",
    country: "GB",
    reliability: 92,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "bbc-tech",
    name: "BBC Technology",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    sourceId: "s3",
    category: "Technology",
    language: "en",
    country: "GB",
    reliability: 92,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "reuters-top",
    name: "Reuters",
    domain: "reuters.com",
    feedUrl: "https://www.reutersagency.com/feed/",
    sourceId: "s1",
    category: "World",
    language: "en",
    reliability: 96,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 25,
  },
  {
    id: "ap-top",
    name: "Associated Press",
    domain: "apnews.com",
    feedUrl: "https://apnews.com/hub/ap-top-news?output=rss",
    sourceId: "s2",
    category: "General",
    language: "en",
    country: "US",
    reliability: 95,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 25,
  },
  {
    id: "npr-news",
    name: "NPR",
    domain: "npr.org",
    feedUrl: "https://feeds.npr.org/1001/rss.xml",
    sourceId: "s9",
    category: "General",
    language: "en",
    country: "US",
    reliability: 87,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "guardian-world",
    name: "The Guardian",
    domain: "theguardian.com",
    feedUrl: "https://www.theguardian.com/world/rss",
    sourceId: "s6",
    category: "World",
    language: "en",
    country: "GB",
    reliability: 85,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 25,
  },
  {
    id: "guardian-business",
    name: "The Guardian Business",
    domain: "theguardian.com",
    feedUrl: "https://www.theguardian.com/uk/business/rss",
    sourceId: "s6",
    category: "Business",
    language: "en",
    country: "GB",
    reliability: 85,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "nyt-world",
    name: "The New York Times",
    domain: "nytimes.com",
    feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    sourceId: "s4",
    category: "World",
    language: "en",
    country: "US",
    reliability: 88,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "politico-picks",
    name: "Politico",
    domain: "politico.com",
    feedUrl: "https://www.politico.com/rss/politicopicks.xml",
    sourceId: "s11",
    category: "Politics",
    language: "en",
    country: "US",
    reliability: 82,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: false,
    maxItemsPerFetch: 20,
  },
  {
    id: "axios-top",
    name: "Axios",
    domain: "axios.com",
    feedUrl: "https://api.axios.com/feed/",
    sourceId: "s12",
    category: "General",
    language: "en",
    country: "US",
    reliability: 83,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "aljazeera-all",
    name: "Al Jazeera",
    domain: "aljazeera.com",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    sourceId: "s10",
    category: "World",
    language: "en",
    reliability: 80,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "nbc-top",
    name: "NBC News",
    domain: "nbcnews.com",
    feedUrl: "https://feeds.nbcnews.com/nbcnews/public/news",
    sourceId: "nbc",
    category: "General",
    language: "en",
    country: "US",
    reliability: 78,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
  {
    id: "cnn-top",
    name: "CNN",
    domain: "cnn.com",
    feedUrl: "http://rss.cnn.com/rss/cnn_topstories.rss",
    sourceId: "cnn",
    category: "General",
    language: "en",
    country: "US",
    reliability: 75,
    enabled: true,
    contentPolicy: "feed_summary_only",
    includeImage: true,
    maxItemsPerFetch: 20,
  },
];

function parseRegistryJson(json: string | undefined): RssFeedRegistryEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        domain: String(row.domain),
        feedUrl: String(row.feedUrl),
        sourceId: String(row.sourceId ?? row.domain),
        category: (row.category as Category) ?? "General",
        language: String(row.language ?? "en"),
        country: row.country ? String(row.country) : undefined,
        reliability: Number(row.reliability) || 55,
        enabled: row.enabled !== false,
        contentPolicy: (row.contentPolicy as ArticleContentPolicy) ?? "feed_summary_only",
        includeImage: row.includeImage !== false,
        maxItemsPerFetch: Number(row.maxItemsPerFetch) || 20,
      }));
  } catch {
    return [];
  }
}

function legacyUrlEntries(urls: string[]): RssFeedRegistryEntry[] {
  return urls.map((feedUrl, i) => {
    let domain = "unknown";
    try {
      domain = new URL(feedUrl).hostname.replace(/^www\./, "");
    } catch {
      /* keep unknown */
    }
    return {
      id: `legacy-${i}-${domain}`,
      name: domain,
      domain,
      feedUrl,
      sourceId: domain,
      category: "General" as Category,
      language: "en",
      reliability: 55,
      enabled: true,
      contentPolicy: "feed_summary_only",
      includeImage: true,
      maxItemsPerFetch: 20,
    };
  });
}

/**
 * Build the active RSS feed registry from defaults, env overrides, and legacy URLs.
 */
export function loadRssFeedRegistry(legacyFeedUrls: string[] = []): RssFeedRegistryEntry[] {
  const useDefaults = parseBool(readString("RSS_USE_DEFAULT_REGISTRY"), true);
  const enabledIds = new Set(parseCsv(readString("RSS_ENABLED_FEED_IDS")));
  const disabledIds = new Set(parseCsv(readString("RSS_DISABLED_FEED_IDS")));
  const custom = parseRegistryJson(readString("RSS_FEEDS_JSON"));

  let feeds: RssFeedRegistryEntry[] = [];

  if (useDefaults) {
    feeds = DEFAULT_RSS_FEED_REGISTRY.map((f) => ({ ...f }));
  }

  const byId = new Map(feeds.map((f) => [f.id, f]));
  for (const entry of custom) {
    byId.set(entry.id, entry);
  }
  for (const major of MAJOR_US_WORLD_RSS_FEEDS) {
    byId.set(major.id, major);
  }
  feeds = [...byId.values()];

  for (const legacy of legacyUrlEntries(legacyFeedUrls)) {
    if (!byId.has(legacy.id)) feeds.push(legacy);
  }

  return feeds.filter((f) => {
    if (disabledIds.has(f.id)) return false;
    if (enabledIds.size > 0) return enabledIds.has(f.id) && f.enabled;
    return f.enabled;
  });
}

export function listRssRegistryIds(): string[] {
  return DEFAULT_RSS_FEED_REGISTRY.map((f) => f.id);
}
