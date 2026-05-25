import type { RawArticle } from "../providers/types";
import type { RssFeedRegistryEntry } from "./registry";

/** Round-robin merge so no single outlet dominates the global article cap. */
export function interleaveFeedBuckets(
  buckets: Map<string, RawArticle[]>,
  maxTotal: number,
): RawArticle[] {
  const feedIds = [...buckets.keys()];
  const out: RawArticle[] = [];
  let round = 0;

  while (out.length < maxTotal) {
    let added = false;
    for (const feedId of feedIds) {
      const bucket = buckets.get(feedId);
      const item = bucket?.[round];
      if (!item) continue;
      out.push(item);
      added = true;
      if (out.length >= maxTotal) break;
    }
    if (!added) break;
    round += 1;
  }

  return out;
}

/** At least one item per successful feed, then fill up to perFeedMax. */
export function capItemsPerFeed(
  items: RawArticle[],
  perFeedMax: number,
): RawArticle[] {
  if (items.length <= perFeedMax) return items;
  const guaranteed = items[0];
  const rest = items.slice(1, perFeedMax);
  return guaranteed ? [guaranteed, ...rest].slice(0, perFeedMax) : items.slice(0, perFeedMax);
}

export function perFeedArticleLimit(
  registryLength: number,
  maxArticles: number,
  feed: RssFeedRegistryEntry,
): number {
  if (registryLength <= 0) return feed.maxItemsPerFetch;
  const share = Math.max(1, Math.ceil(maxArticles / registryLength));
  return Math.min(feed.maxItemsPerFetch, share);
}
