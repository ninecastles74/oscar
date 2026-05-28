import { env as cloudflareEnv } from "cloudflare:workers";
import { getServerEnv, isServerEnvFalse } from "../env/server-env";

const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
] as const;

function readCloudflareKey(key: string): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function readKey(name: string): string | undefined {
  return readCloudflareKey(name) ?? getServerEnv(name);
}

/** Google AI Studio keys usually start with AIza */
function isLikelyGoogleAiKey(value: string): boolean {
  return value.startsWith("AIza") && value.length > 20;
}

/** Resolve Google AI / Gemini API key. */
export function getGoogleAiApiKey(): string | undefined {
  for (const name of GEMINI_KEY_NAMES) {
    const v = readKey(name);
    if (v) return v;
  }
  const googleApi = readKey("GOOGLE_API_KEY");
  if (googleApi && isLikelyGoogleAiKey(googleApi)) return googleApi;
  return undefined;
}

export function isGoogleAiConfigured(): boolean {
  return !!getGoogleAiApiKey();
}

export function isGeminiGoogleSearchEnabled(): boolean {
  return !isServerEnvFalse("GEMINI_ENABLE_GOOGLE_SEARCH");
}

export function geminiVerificationModel(): string {
  return readKey("GEMINI_VERIFICATION_MODEL") ?? getServerEnv("GEMINI_VERIFICATION_MODEL") ?? "gemini-2.5-flash";
}
