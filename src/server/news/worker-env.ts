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
let backgroundWaitUntil: ((promise: Promise<unknown>) => void) | null = null;

export function setWorkerBindings(env: unknown): void {
  if (env && typeof env === "object") {
    bindings = env as OscarWorkerBindings;
    return;
  }
  bindings = null;
}

/** Register Cloudflare execution context for background work (manual analysis, etc.). */
export function setWorkerExecutionContext(ctx: unknown): void {
  if (ctx && typeof ctx === "object" && "waitUntil" in ctx) {
    const w = (ctx as { waitUntil: (p: Promise<unknown>) => void }).waitUntil;
    backgroundWaitUntil = typeof w === "function" ? w.bind(ctx) : null;
    return;
  }
  backgroundWaitUntil = null;
}

/** Run work after the HTTP response (Workers) or fire-and-forget locally. */
export function runInWorkerBackground(promise: Promise<unknown>): void {
  if (backgroundWaitUntil) {
    backgroundWaitUntil(promise);
    return;
  }
  void promise;
}

export function getFeedKv(): FeedKvNamespace | undefined {
  return bindings?.FEED_KV;
}

export function isFeedKvConfigured(): boolean {
  return !!bindings?.FEED_KV;
}
