import type { ArticleIngestMetadata, Category, NewsArticle } from "@/types/news-platform";
import { normalizeImageUrl } from "@/lib/article-image";
import { canonicalizeUrl, extractDomain } from "./utils/url";
import { contentHash, stableArticleId } from "./utils/text";
import type { RawArticle } from "./providers/types";

const CATEGORY_MAP: Record<string, Category> = {
  politics: "Politics",
  political: "Politics",
  world: "World",
  international: "World",
  business: "Business",
  finance: "Markets",
  markets: "Markets",
  technology: "Technology",
  tech: "Technology",
  science: "Science",
  health: "Health",
  climate: "Climate",
  environment: "Climate",
  sports: "Sports",
  sport: "Sports",
  entertainment: "Entertainment",
  culture: "Entertainment",
  general: "General",
};

export function coerceCategory(raw: string | undefined): Category {
  if (!raw) return "General";
  const key = raw.toLowerCase().trim();
  if (key in CATEGORY_MAP) return CATEGORY_MAP[key];
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const allowed: Category[] = [
    "Politics",
    "World",
    "Business",
    "Technology",
    "Science",
    "Health",
    "Climate",
    "Markets",
    "Sports",
    "Entertainment",
    "General",
  ];
  return allowed.includes(titled as Category) ? (titled as Category) : "General";
}

export async function normalizeArticle(raw: RawArticle): Promise<NewsArticle | null> {
  const title = raw.title?.trim();
  const url = raw.url?.trim();
  if (!title || !url) return null;

  const canonical = canonicalizeUrl(url);
  const domain = extractDomain(raw.sourceDomain || url);
  const description = (raw.description || title).trim().slice(0, 2000);
  const publishedAt = raw.publishedAt || new Date().toISOString();
  const hash = await contentHash(title, description, canonical);

  const contentPolicy = raw.contentPolicy ?? "feed_summary_only";
  const mayStoreFullText = contentPolicy === "licensed_full_text" && raw.allowFullText === true;
  const fullText = mayStoreFullText ? raw.fullText : undefined;

  let ingestMetadata: ArticleIngestMetadata | undefined;
  if (raw.feedId && raw.feedUrl) {
    ingestMetadata = {
      feedId: raw.feedId,
      feedUrl: raw.feedUrl,
      summary: description,
      contentPolicy,
      summarySource: raw.summarySource ?? "rss_description",
      imageSource: raw.imageSource ?? (raw.imageUrl ? "media_content" : "none"),
      rightsNote:
        contentPolicy === "feed_summary_only"
          ? "Only feed-provided summary stored; full article text not persisted."
          : undefined,
      claimsPending: true,
    };
  }

  const extractedClaims = raw.extractedClaims ?? [];

  return {
    id: stableArticleId(canonical),
    title,
    headline: title,
    description,
    url: canonical,
    sourceName: raw.sourceName || domain,
    sourceDomain: domain,
    sourceId: raw.sourceId,
    author: raw.author,
    publishedAt,
    imageUrl: normalizeImageUrl(raw.imageUrl),
    originalApiProvider: raw.provider,
    category: coerceCategory(String(raw.category)),
    country: raw.country,
    language: raw.language || "en",
    fullText,
    wordCount: fullText ? fullText.split(/\s+/).length : undefined,
    contentHash: hash,
    isDuplicate: false,
    ingestMetadata,
    extractedClaims,
  };
}

export async function normalizeArticles(raw: RawArticle[]): Promise<NewsArticle[]> {
  const out: NewsArticle[] = [];
  for (const r of raw) {
    const n = await normalizeArticle(r);
    if (n) out.push(n);
  }
  return out;
}
