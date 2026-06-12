import type { ApiProviderId } from "@/types/news-platform";
import { loadRssFeedRegistry } from "./rss/registry";

/** Server-only environment access. Never import this module from client components. */
export interface NewsIngestionEnv {
  newsApiKey?: string;
  gnewsApiKey?: string;
  guardianApiKey?: string;
  rssFeedUrls: string[];
  publisherFeeds: PublisherFeedConfig[];
  enabledProviders: ApiProviderId[];
  fetchTimeoutMs: number;
  rateLimits: Record<string, number>;
  ingestMaxArticlesPerProvider: number;
  ingestCountry: string;
  ingestLanguage: string;
}

export interface PublisherFeedConfig {
  id: string;
  name: string;
  domain: string;
  feedUrl: string;
  category?: string;
  language?: string;
  reliability?: number;
}

function readString(key: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env[key] : undefined;
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function readInt(key: string, fallback: number): number {
  const raw = readString(key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePublisherFeeds(json: string | undefined): PublisherFeedConfig[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PublisherFeedConfig => {
        return (
          !!item &&
          typeof item === "object" &&
          typeof (item as PublisherFeedConfig).id === "string" &&
          typeof (item as PublisherFeedConfig).name === "string" &&
          typeof (item as PublisherFeedConfig).domain === "string" &&
          typeof (item as PublisherFeedConfig).feedUrl === "string"
        );
      })
      .map((f) => ({
        id: f.id,
        name: f.name,
        domain: f.domain,
        feedUrl: f.feedUrl,
        category: f.category,
        language: f.language ?? "en",
        reliability: f.reliability,
      }));
  } catch {
    return [];
  }
}

function parseEnabledProviders(raw: string | undefined): ApiProviderId[] {
  const all: ApiProviderId[] = ["newsapi", "gnews", "guardian", "rss", "publishers"];
  const list = parseCsv(raw) as ApiProviderId[];
  // Default to RSS-only (free, no API keys). Avoid enabling publishers without PUBLISHER_FEEDS_JSON.
  if (list.length === 0) return ["rss"];
  return list.filter((p) => all.includes(p));
}

/** Load ingestion config from process.env (Cloudflare: bind via Wrangler / .dev.vars). */
export function getNewsIngestionEnv(): NewsIngestionEnv {
  const enabled = parseEnabledProviders(readString("NEWS_INGEST_ENABLED_PROVIDERS"));

  return {
    newsApiKey: readString("NEWS_API_KEY"),
    gnewsApiKey: readString("GNEWS_API_KEY"),
    guardianApiKey: readString("GUARDIAN_API_KEY"),
    rssFeedUrls: parseCsv(readString("RSS_FEED_URLS")),
    publisherFeeds: parsePublisherFeeds(readString("PUBLISHER_FEEDS_JSON")),
    enabledProviders: enabled,
    fetchTimeoutMs: readInt("NEWS_FETCH_TIMEOUT_MS", 15_000),
    ingestMaxArticlesPerProvider: readInt("NEWS_INGEST_MAX_ARTICLES_PER_PROVIDER", 150),
    ingestCountry: readString("NEWS_INGEST_COUNTRY") ?? "us",
    ingestLanguage: readString("NEWS_INGEST_LANGUAGE") ?? "en",
    rateLimits: {
      newsapi: readInt("NEWSAPI_RATE_LIMIT_PER_MIN", 30),
      gnews: readInt("GNEWS_RATE_LIMIT_PER_MIN", 30),
      guardian: readInt("GUARDIAN_RATE_LIMIT_PER_MIN", 60),
      rss: readInt("RSS_RATE_LIMIT_PER_MIN", 120),
      publishers: readInt("PUBLISHERS_RATE_LIMIT_PER_MIN", 120),
    },
  };
}

export function isProviderConfigured(provider: ApiProviderId, env: NewsIngestionEnv): boolean {
  switch (provider) {
    case "newsapi":
      return !!env.newsApiKey;
    case "gnews":
      return !!env.gnewsApiKey;
    case "guardian":
      return !!env.guardianApiKey;
    case "rss":
      return loadRssFeedRegistry(env.rssFeedUrls).length > 0;
    case "publishers":
      return env.publisherFeeds.length > 0;
    default:
      return false;
  }
}
