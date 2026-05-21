import { IngestionError } from "./errors";

interface WindowState {
  count: number;
  windowStartMs: number;
}

const windows = new Map<string, WindowState>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-memory sliding-window rate limiter (per provider id).
 * Resets when the worker cold-starts; suitable for dev and single-instance Workers.
 */
export async function acquireRateLimit(providerId: string, limitPerMinute: number): Promise<void> {
  if (limitPerMinute <= 0) return;

  const now = Date.now();
  const windowMs = 60_000;
  let state = windows.get(providerId);

  if (!state || now - state.windowStartMs >= windowMs) {
    state = { count: 0, windowStartMs: now };
    windows.set(providerId, state);
  }

  if (state.count >= limitPerMinute) {
    const waitMs = windowMs - (now - state.windowStartMs) + 50;
    if (waitMs > 0) await sleep(waitMs);
    state = { count: 0, windowStartMs: Date.now() };
    windows.set(providerId, state);
  }

  state.count += 1;
}

export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

export async function waitForRetryAfter(retryAfterMs: number | undefined): Promise<void> {
  if (!retryAfterMs || retryAfterMs <= 0) return;
  const capped = Math.min(retryAfterMs, 60_000);
  await sleep(capped);
}

export function throwIfRateLimited(provider: string, status: number, retryAfterMs?: number): void {
  if (status === 429) {
    throw new IngestionError({
      code: "RATE_LIMITED",
      provider,
      message: `Provider ${provider} rate limited (HTTP 429)`,
      statusCode: 429,
      retryAfterMs,
    });
  }
}
