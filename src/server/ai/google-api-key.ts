import { getServerEnv, isServerEnvFalse } from "../env/server-env";

/** Resolve Google AI / Gemini API key from Workers secrets or local .dev.vars. */
export function getGoogleAiApiKey(): string | undefined {
  return (
    getServerEnv("GOOGLE_AI_API_KEY") ||
    getServerEnv("GEMINI_API_KEY") ||
    getServerEnv("GOOGLE_GENERATIVE_AI_API_KEY")
  );
}

export function isGoogleAiConfigured(): boolean {
  return !!getGoogleAiApiKey();
}

export function isGeminiGoogleSearchEnabled(): boolean {
  return !isServerEnvFalse("GEMINI_ENABLE_GOOGLE_SEARCH");
}

export function geminiVerificationModel(): string {
  return getServerEnv("GEMINI_VERIFICATION_MODEL") || "gemini-2.5-flash";
}
