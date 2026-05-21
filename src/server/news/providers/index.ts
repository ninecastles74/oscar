import type { ApiProviderId } from "@/types/news-platform";
import type { NewsIngestionEnv } from "../env";
import { getNewsIngestionEnv, isProviderConfigured } from "../env";
import { IngestionError, isIngestionError } from "../errors";
import type { ProviderContext, ProviderFetchResult } from "./types";
import { fetchNewsApi } from "./newsapi";
import { fetchGNews } from "./gnews";
import { fetchGuardian } from "./guardian";
import { fetchRssFeeds } from "./rss";
import { fetchPublisherFeeds } from "./publishers";

export type ProviderErrorRecord = {
  provider: ApiProviderId | string;
  code: string;
  message: string;
  statusCode?: number;
};

const FETCHERS: Record<
  ApiProviderId,
  (env: NewsIngestionEnv, ctx: ProviderContext) => Promise<ProviderFetchResult>
> = {
  newsapi: fetchNewsApi,
  gnews: fetchGNews,
  guardian: fetchGuardian,
  rss: fetchRssFeeds,
  publishers: fetchPublisherFeeds,
  nyt: async () => {
    throw new IngestionError({
      code: "PROVIDER_DISABLED",
      provider: "nyt",
      message: "NYT provider not implemented yet",
    });
  },
};

export async function fetchAllProviders(
  options?: Partial<ProviderContext> & { providers?: ApiProviderId[] },
): Promise<{ results: ProviderFetchResult[]; errors: ProviderErrorRecord[] }> {
  const env = getNewsIngestionEnv();
  const ctx: ProviderContext = {
    country: options?.country ?? env.ingestCountry,
    language: options?.language ?? env.ingestLanguage,
    maxArticles: options?.maxArticles ?? env.ingestMaxArticlesPerProvider,
  };

  const toRun = (options?.providers ?? env.enabledProviders).filter((p) => {
    if (!env.enabledProviders.includes(p)) return false;
    return isProviderConfigured(p, env);
  });

  const results: ProviderFetchResult[] = [];
  const errors: ProviderErrorRecord[] = [];

  await Promise.all(
    toRun.map(async (provider) => {
      try {
        const result = await FETCHERS[provider](env, ctx);
        results.push(result);
      } catch (err) {
        if (isIngestionError(err)) {
          errors.push(err.toJSON());
        } else {
          errors.push({
            provider,
            code: "NETWORK_ERROR",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }),
  );

  const skipped = env.enabledProviders.filter(
    (p) => !toRun.includes(p) && !errors.some((e) => e.provider === p),
  );
  for (const p of skipped) {
    if (!isProviderConfigured(p, env)) {
      errors.push({
        provider: p,
        code: "MISSING_API_KEY",
        message: `${p} is enabled but not configured (missing key or feed URLs)`,
      });
    }
  }

  return { results, errors };
}
