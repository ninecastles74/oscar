import type { NewsIngestionEnv } from "../env";
import { IngestionError } from "../errors";
import { normalizeArticles } from "../normalize";
import { fetchWithRateLimit } from "./http";
import type { ProviderContext, ProviderFetchResult, RawArticle } from "./types";

interface GNewsArticle {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string; url?: string };
}

interface GNewsResponse {
  totalArticles?: number;
  articles?: GNewsArticle[];
  errors?: string[];
}

export async function fetchGNews(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  const provider = "gnews" as const;
  if (!env.gnewsApiKey) {
    throw new IngestionError({
      code: "MISSING_API_KEY",
      provider,
      message: "GNEWS_API_KEY is not configured",
    });
  }

  const start = Date.now();
  const params = new URLSearchParams({
    token: env.gnewsApiKey,
    lang: ctx.language,
    country: ctx.country,
    max: String(Math.min(ctx.maxArticles, 100)),
  });

  const url = `https://gnews.io/api/v4/top-headlines?${params}`;
  const res = await fetchWithRateLimit(provider, url, env);
  const json = (await res.json()) as GNewsResponse;

  if (json.errors?.length) {
    throw new IngestionError({
      code: "HTTP_ERROR",
      provider,
      message: json.errors.join("; "),
    });
  }

  const raw: RawArticle[] = (json.articles ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title!,
      description: a.description ?? a.content?.slice(0, 500) ?? a.title!,
      url: a.url!,
      sourceName: a.source?.name ?? "Unknown",
      sourceDomain: a.source?.url ?? a.url!,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      imageUrl: a.image,
      category: "General",
      language: ctx.language,
      fullText: a.content,
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
