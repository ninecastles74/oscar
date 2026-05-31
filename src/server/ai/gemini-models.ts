import { getServerEnv } from "../env/server-env";

/** Default for verification + Google Search (reliable JSON on free tier). */
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

/** Valid Gemini model IDs per https://ai.google.dev/gemini-api/docs/models */
export const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
] as const;

export function resolveGeminiVerificationModel(): string {
  const fromEnv = getServerEnv("GEMINI_VERIFICATION_MODEL")?.trim();
  return fromEnv || GEMINI_DEFAULT_MODEL;
}

export function geminiModelCandidates(override?: string): string[] {
  const primary = override?.trim() || resolveGeminiVerificationModel();
  return [...new Set([primary, ...GEMINI_MODEL_FALLBACKS].filter(Boolean))];
}
