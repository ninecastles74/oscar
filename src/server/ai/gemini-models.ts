import { getServerEnv } from "../env/server-env";

/** Default for verification + Google Search (reliable JSON on free tier). */
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

/** Valid Gemini model IDs per https://ai.google.dev/gemini-api/docs/models */
export const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

export function resolveGeminiVerificationModel(): string {
  const fromEnv = getServerEnv("GEMINI_VERIFICATION_MODEL")?.trim();
  return fromEnv || GEMINI_DEFAULT_MODEL;
}

/** Explicit fallback when primary hits capacity limits (503 / high demand). */
export function resolveGeminiFallbackModel(): string {
  const fromEnv = getServerEnv("GEMINI_FALLBACK_MODEL")?.trim();
  return fromEnv || "gemini-2.5-flash-lite";
}

export function geminiModelCandidates(override?: string): string[] {
  const primary = override?.trim() || resolveGeminiVerificationModel();
  const explicitFallback = resolveGeminiFallbackModel();
  return [...new Set([primary, explicitFallback, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))];
}
