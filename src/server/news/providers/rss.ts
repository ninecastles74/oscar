import type { NewsIngestionEnv } from "../env";
import type { ProviderContext, ProviderFetchResult } from "./types";
import { fetchRssFromRegistry } from "../rss/ingest";

/** Fetch articles from the configurable RSS feed registry. */
export async function fetchRssFeeds(
  env: NewsIngestionEnv,
  ctx: ProviderContext,
): Promise<ProviderFetchResult> {
  return fetchRssFromRegistry(env, ctx);
}
