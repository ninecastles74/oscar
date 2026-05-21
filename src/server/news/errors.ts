import type { ApiProviderId } from "@/types/news-platform";

export type IngestionErrorCode =
  | "PROVIDER_DISABLED"
  | "MISSING_API_KEY"
  | "RATE_LIMITED"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
  readonly provider: ApiProviderId | string;
  readonly statusCode?: number;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;

  constructor(params: {
    code: IngestionErrorCode;
    provider: ApiProviderId | string;
    message: string;
    statusCode?: number;
    retryAfterMs?: number;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "IngestionError";
    this.code = params.code;
    this.provider = params.provider;
    this.statusCode = params.statusCode;
    this.retryAfterMs = params.retryAfterMs;
    this.cause = params.cause;
  }

  toJSON() {
    return {
      code: this.code,
      provider: this.provider,
      message: this.message,
      statusCode: this.statusCode,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

export function isIngestionError(err: unknown): err is IngestionError {
  return err instanceof IngestionError;
}
