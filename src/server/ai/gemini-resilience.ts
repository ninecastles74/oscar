import type { PipelineWarning } from "@/types/news-platform";

/** User-safe copy — never include raw provider HTTP bodies. */
export const GEMINI_CAPACITY_USER_MESSAGE =
  "Live web evidence was temporarily unavailable due to high demand on Google's Gemini API. Analysis continued using OpenAI and Claude where configured; affected claims may be marked Unclear or Insufficient Evidence.";

export function isGeminiCapacityHttpError(status: number, message: string): boolean {
  return (
    status === 503 ||
    status === 529 ||
    /high demand|overloaded|temporarily unavailable|capacity|resource exhausted|try again later|unavailable/i.test(
      message,
    )
  );
}

export function buildGeminiCapacityWarning(details?: string): PipelineWarning {
  return {
    code: "GEMINI_CAPACITY_DEGRADED",
    message: GEMINI_CAPACITY_USER_MESSAGE,
    ...(details ? { details } : {}),
  };
}

let capacityHit = false;
let capacityAdminLog: string[] = [];
let lastFallbackModel: string | undefined;

export function noteGeminiCapacityFailure(adminLine: string): void {
  capacityHit = true;
  capacityAdminLog.push(adminLine);
}

export function noteGeminiFallbackUsed(model: string): void {
  lastFallbackModel = model;
  console.log("[gemini-resilience] fallback model succeeded:", model);
}

export function resetGeminiResilienceState(): void {
  capacityHit = false;
  capacityAdminLog = [];
  lastFallbackModel = undefined;
}

export function hadGeminiCapacityFailure(): boolean {
  return capacityHit;
}

export function getGeminiCapacityAdminLog(): string[] {
  return [...capacityAdminLog];
}

export function getLastGeminiFallbackModel(): string | undefined {
  return lastFallbackModel;
}

/** Strip raw provider HTTP errors from user-visible copy. */
export function sanitizeUserFacingAnalysisError(message: string): string {
  if (
    /HTTP 503|high demand|gemini-[\d.]+-flash@v1beta|temporarily unavailable|overloaded/i.test(
      message,
    )
  ) {
    return GEMINI_CAPACITY_USER_MESSAGE;
  }
  if (/HTTP \d{3}/.test(message)) {
    return "Analysis encountered a temporary AI provider issue. Please retry in a few minutes.";
  }
  return message;
}
