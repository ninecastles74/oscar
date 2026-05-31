import { env as cloudflareEnv } from "cloudflare:workers";
import { resolveGeminiVerificationModel } from "./gemini-models";
import {
  describeGoogleKeyProblem,
  sanitizeGoogleApiKeyOrUndefined,
} from "./sanitize-api-secret";
import { getServerEnv, isServerEnvFalse } from "../env/server-env";

const GEMINI_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
] as const;

function readRawKey(name: string): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>)[name];
  if (typeof v === "string" && v.trim()) return v;
  return getServerEnv(name);
}

function readGoogleKey(name: string): string | undefined {
  return sanitizeGoogleApiKeyOrUndefined(readRawKey(name));
}

/** Resolve Google AI / Gemini API key. */
export function getGoogleAiApiKey(): string | undefined {
  return getGoogleAiApiKeyMeta()?.key;
}

export function getGoogleAiApiKeyMeta(): { key: string; source: string } | undefined {
  for (const name of GEMINI_KEY_NAMES) {
    const v = readGoogleKey(name);
    if (v) return { key: v, source: name };
  }
  const fromGoogleApi = sanitizeGoogleApiKeyOrUndefined(readRawKey("GOOGLE_API_KEY"));
  if (fromGoogleApi) return { key: fromGoogleApi, source: "GOOGLE_API_KEY" };
  return undefined;
}

export function getGoogleAiKeyInvalidHint(source?: string): string {
  return (
    `Google rejected the API key${source ? ` from ${source}` : ""}. ` +
    "Create a new key at https://aistudio.google.com/apikey (not Google Maps/Cloud Console), " +
    "save it as Cloudflare Secret GEMINI_API_KEY (value = AIza… only), delete other GOOGLE_* keys if unused, then redeploy."
  );
}

export function getGoogleAiKeySetupHint(): string | undefined {
  for (const name of [...GEMINI_KEY_NAMES, "GOOGLE_API_KEY"] as const) {
    const raw = readRawKey(name);
    if (!raw?.trim()) continue;
    return describeGoogleKeyProblem(raw);
  }
  return "GEMINI_API_KEY secret is missing. Add it under Workers → oscar → Secrets (Production), then redeploy.";
}

export function isGoogleAiConfigured(): boolean {
  return !!getGoogleAiApiKey();
}

export function isGeminiGoogleSearchEnabled(): boolean {
  return !isServerEnvFalse("GEMINI_ENABLE_GOOGLE_SEARCH");
}

export function geminiVerificationModel(): string {
  return resolveGeminiVerificationModel();
}
