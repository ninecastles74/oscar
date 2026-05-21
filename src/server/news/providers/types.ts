import type {
  ApiProviderId,
  ArticleContentPolicy,
  ArticleImageSource,
  Category,
  NewsArticle,
} from "@/types/news-platform";

/** Raw article shape before normalization to NewsArticle. */
export interface RawArticle {
  externalId?: string;
  title: string;
  description: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  sourceId?: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  category: Category | string;
  language: string;
  country?: string;
  fullText?: string;
  provider: ApiProviderId | string;
  /** RSS registry fields */
  feedId?: string;
  feedUrl?: string;
  summarySource?: "rss_description" | "rss_summary" | "title_fallback";
  imageSource?: ArticleImageSource;
  contentPolicy?: ArticleContentPolicy;
  allowFullText?: boolean;
  extractedClaims?: string[];
}

export interface ProviderFetchResult {
  provider: ApiProviderId | string;
  articles: NewsArticle[];
  fetched: number;
  skipped: number;
  durationMs: number;
}

export interface ProviderContext {
  country: string;
  language: string;
  maxArticles: number;
}
