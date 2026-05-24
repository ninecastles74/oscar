import type { NewsIngestionEnv } from "../env";
import { IngestionError } from "../errors";
import { normalizeImageUrl } from "@/lib/article-image";
import { normalizeArticles, coerceCategory } from "../normalize";
import { fetchWithRateLimit } from "./http";
import type { ProviderContext, ProviderFetchResult, RawArticle } from "./types";

interface GuardianField {
  webTitle?: string;
  webUrl?: string;
  trailText?: string;
  thumbnail?: string;
  lastModified?: string;
  sectionName?: string;
}

interface GuardianResult {
  webTitle?: string;
  webUrl?: string;
  fields?: GuardianField;
  sectionName?: string;
}

interface GuardianResponse {
  response?: {
    status?: string;
    message?: string;
    results?: GuardianResult[];
  };
}

export async function fetchGuardian(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  const provider = "guardian" as const;
  if (!env.guardianApiKey) {
    throw new IngestionError({
      code: "MISSING_API_KEY",
      provider,
      message: "GUARDIAN_API_KEY is not configured",
    });
  }

  const start = Date.now();
  const params = new URLSearchParams({
    "api-key": env.guardianApiKey,
    "page-size": String(Math.min(ctx.maxArticles, 50)),
    "show-fields": "trailText,thumbnail,lastModified",
    orderBy: "newest",
  });

  const url = `https://content.guardianapis.com/search?${params}`;
  const res = await fetchWithRateLimit(provider, url, env);
  const json = (await res.json()) as GuardianResponse;

  if (json.response?.status === "error") {
    throw new IngestionError({
      code: "HTTP_ERROR",
      provider,
      message: json.response.message ?? "Guardian API error",
    });
  }

  const raw: RawArticle[] = (json.response?.results ?? [])
    .filter((r) => r.webTitle && r.webUrl)
    .map((r) => ({
      title: r.webTitle!,
      description: r.fields?.trailText ?? r.webTitle!,
      url: r.webUrl!,
      sourceName: "The Guardian",
      sourceDomain: "theguardian.com",
      publishedAt: r.fields?.lastModified ?? new Date().toISOString(),
      imageUrl: normalizeImageUrl(r.fields?.thumbnail),
      category: coerceCategory(r.sectionName ?? "General"),
      language: ctx.language,
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
