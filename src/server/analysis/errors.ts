export type AnalysisErrorCode =
  | "VALIDATION_ERROR"
  | "URL_BLOCKED"
  | "URL_FETCH_FAILED"
  | "INSUFFICIENT_CONTENT"
  | "PIPELINE_ERROR"
  | "QUOTA_EXCEEDED"
  | "AUTH_REQUIRED"
  | "LIVE_AI_REQUIRED";

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  readonly statusCode: number;

  constructor(code: AnalysisErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
