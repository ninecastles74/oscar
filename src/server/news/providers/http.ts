import { IngestionError } from "../errors";
import {
  acquireRateLimit,
  parseRetryAfterMs,
  throwIfRateLimited,
  waitForRetryAfter,
} from "../rate-limit";
import type { NewsIngestionEnv } from "../env";

export async function fetchWithRateLimit(
  providerId: string,
  url: string,
  env: NewsIngestionEnv,
  init?: RequestInit,
): Promise<Response> {
  const limit = env.rateLimits[providerId] ?? 60;
  await acquireRateLimit(providerId, limit);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.fetchTimeoutMs);

  try {
    let response = await fetch(url, { ...init, signal: controller.signal });

    if (response.status === 429) {
      const retryMs = parseRetryAfterMs(response.headers.get("Retry-After"));
      await waitForRetryAfter(retryMs);
      await acquireRateLimit(providerId, limit);
      response = await fetch(url, { ...init, signal: controller.signal });
    }

    throwIfRateLimited(
      providerId,
      response.status,
      parseRetryAfterMs(response.headers.get("Retry-After")),
    );

    if (!response.ok) {
      throw new IngestionError({
        code: response.status >= 500 ? "HTTP_ERROR" : "HTTP_ERROR",
        provider: providerId,
        message: `HTTP ${response.status} from ${providerId}`,
        statusCode: response.status,
      });
    }

    return response;
  } catch (err) {
    if (err instanceof IngestionError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new IngestionError({
        code: "TIMEOUT",
        provider: providerId,
        message: `Request to ${providerId} timed out after ${env.fetchTimeoutMs}ms`,
        cause: err,
      });
    }
    throw new IngestionError({
      code: "NETWORK_ERROR",
      provider: providerId,
      message: `Network error fetching ${providerId}`,
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}
