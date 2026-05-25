/** Resolve Google AI / Gemini API key from Workers secrets or local .dev.vars. */
export function getGoogleAiApiKey(): string | undefined {
  const key =
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return key || undefined;
}

export function isGoogleAiConfigured(): boolean {
  return !!getGoogleAiApiKey();
}

export function isGeminiGoogleSearchEnabled(): boolean {
  return process.env.GEMINI_ENABLE_GOOGLE_SEARCH !== "false";
}

export function geminiVerificationModel(): string {
  return process.env.GEMINI_VERIFICATION_MODEL?.trim() || "gemini-2.5-flash";
}
