/** Minimal KV types (Cloudflare binding). */
export interface FeedKvNamespace {
  get(key: string, type: "json"): Promise<unknown>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Cloudflare Worker bindings (KV, etc.) — set from src/server.ts on each invocation. */
export interface OscarWorkerBindings {
  FEED_KV?: FeedKvNamespace;
}

let bindings: OscarWorkerBindings | null = null;

export function setWorkerBindings(env: unknown): void {
  if (env && typeof env === "object") {
    bindings = env as OscarWorkerBindings;
    return;
  }
  bindings = null;
}

export function getFeedKv(): FeedKvNamespace | undefined {
  return bindings?.FEED_KV;
}

export function isFeedKvConfigured(): boolean {
  return !!bindings?.FEED_KV;
}
