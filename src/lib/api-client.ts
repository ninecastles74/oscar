type ApiError = {
  success: false;
  error: string;
  details?: string;
  code?: string;
  quota?: import("@/features/analysis/quota-banner").QuotaInfo;
};

type ApiSuccess<T> = { success: true } & T;

const DEFAULT_TIMEOUT_MS = 60_000;
/** Must exceed backend wall timeout (90s) so sync analysis can finish before the client aborts. */
const ANALYZE_TIMEOUT_MS = 100_000;

function timeoutMsFor(url: string): number {
  if (url.includes("/api/analyze/")) return ANALYZE_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<ApiSuccess<T> | ApiError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMsFor(url));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as ApiSuccess<T> | ApiError;

    if (!res.ok) {
      if (data && "success" in data && data.success === false) {
        return data;
      }
      return {
        success: false,
        error: "Request failed",
        details: `HTTP ${res.status}`,
      };
    }

    if (!data || typeof data !== "object" || !("success" in data) || data.success !== true) {
      return {
        success: false,
        error: "Invalid server response",
        details: "Expected success: true in JSON body",
      };
    }

    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "Request timed out",
        details: `No response within ${Math.round(timeoutMsFor(url) / 1000)}s`,
        code: "TIMEOUT",
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
      code: "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T>(url: string): Promise<ApiSuccess<T> | ApiError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = (await res.json()) as ApiSuccess<T> | ApiError;

    if (!res.ok) {
      if (data && "success" in data && data.success === false) {
        return data;
      }
      return {
        success: false,
        error: "Request failed",
        details: `HTTP ${res.status}`,
      };
    }

    if (!data || typeof data !== "object" || !("success" in data) || data.success !== true) {
      return {
        success: false,
        error: "Invalid server response",
        details: "Expected success: true in JSON body",
      };
    }

    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "Request timed out",
        code: "TIMEOUT",
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
      code: "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}
