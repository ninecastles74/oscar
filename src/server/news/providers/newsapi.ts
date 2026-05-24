import type { NewsIngestionEnv } from "../env";
import { IngestionError } from "../errors";
import { normalizeImageUrl } from "@/lib/article-image";
import { normalizeArticles } from "../normalize";
import { fetchWithRateLimit } from "./http";
import type { ProviderContext, ProviderFetchResult, RawArticle } from "./types";

interface NewsApiArticle {
  source?: { id?: string; name?: string };
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  content?: string;
}

interface NewsApiResponse {
  status: string;
  message?: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
}

export async function fetchNewsApi(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  const provider = "newsapi" as const;
  if (!env.newsApiKey) {
    throw new IngestionError({
      code: "MISSING_API_KEY",
      provider,
      message: "NEWS_API_KEY is not configured",
    });
  }

  const start = Date.now();
  const params = new URLSearchParams({
    apiKey: env.newsApiKey,
    country: ctx.country,
    pageSize: String(Math.min(ctx.maxArticles, 100)),
  });

  const url = `https://newsapi.org/v2/top-headlines?${params}`;
  const res = await fetchWithRateLimit(provider, url, env);
  const json = (await res.json()) as NewsApiResponse;

  if (json.status === "error") {
    throw new IngestionError({
      code: "HTTP_ERROR",
      provider,
      message: json.message ?? "NewsAPI returned an error",
    });
  }

  const raw: RawArticle[] = (json.articles ?? [])
    .filter((a) => a.title && a.url && a.title !== "[Removed]")
    .map((a) => ({
      title: a.title!,
      description: a.description ?? a.content?.slice(0, 500) ?? a.title!,
      url: a.url!,
      sourceName: a.source?.name ?? "Unknown",
      sourceDomain: a.url!,
      author: a.author ?? undefined,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      imageUrl: normalizeImageUrl(a.urlToImage),
      category: "General",
      language: ctx.language,
      country: ctx.country.toUpperCase(),
      fullText: a.content ?? undefined,
      provider,
    }));

  const articles = await normalizeArticles(raw.slice(0, ctx.maxArticles));

  return {
    provider,
    articles,
    fetched: raw.length,
    skipped: raw.length - articles.length,
    durationMs: Date.now() - start,
  };
}
