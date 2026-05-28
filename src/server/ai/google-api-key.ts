import { env as cloudflareEnv } from "cloudflare:workers";
import { getServerEnv, isServerEnvFalse } from "../env/server-env";

const GOOGLE_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
] as const;

function readCloudflareKey(key: string): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Resolve Google AI / Gemini API key — cloudflare:workers env first (TanStack Start). */
export function getGoogleAiApiKey(): string | undefined {
  for (const name of GOOGLE_KEY_NAMES) {
    const fromCf = readCloudflareKey(name);
    if (fromCf) return fromCf;
    const fromHelper = getServerEnv(name);
    if (fromHelper) return fromHelper;
  }
  return undefined;
}

export function isGoogleAiConfigured(): boolean {
  return !!getGoogleAiApiKey();
}

export function isGeminiGoogleSearchEnabled(): boolean {
  return !isServerEnvFalse("GEMINI_ENABLE_GOOGLE_SEARCH");
}

export function geminiVerificationModel(): string {
  return (
    readCloudflareKey("GEMINI_VERIFICATION_MODEL") ||
    getServerEnv("GEMINI_VERIFICATION_MODEL") ||
    "gemini-2.0-flash"
  );
}
