/**
 * Resolve Workers secrets/vars from Cloudflare bindings first, then process.env (local .dev.vars).
 * Without this, production can have secrets on `env` but AI code only reading empty process.env.
 */
import { env as cloudflareEnv } from "cloudflare:workers";

export function getServerEnv(key: string): string | undefined {
  const fromBinding = (cloudflareEnv as Record<string, unknown>)[key];
  if (typeof fromBinding === "string" && fromBinding.trim()) {
    return fromBinding.trim();
  }
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }
  return undefined;
}

export function isServerEnvTruthy(key: string): boolean {
  return !!getServerEnv(key);
}

export function isServerEnvFalse(key: string): boolean {
  return getServerEnv(key) === "false";
}

/** Keys synced from the fetch `env` object into process.env each request (backup path). */
export const WORKER_SECRET_ENV_KEYS = [
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "MULTI_MODEL_VERIFICATION_ENABLED",
  "SCHEDULED_USE_MULTI_MODEL",
  "GEMINI_VERIFICATION_MODEL",
  "GEMINI_ENABLE_GOOGLE_SEARCH",
  "GEMINI_FETCH_TIMEOUT_MS",
  "OPENAI_VERIFICATION_MODEL",
  "OPENAI_TOPIC_MODEL",
  "ANTHROPIC_VERIFICATION_MODEL",
  "LLM_FETCH_TIMEOUT_MS",
] as const;

export function mirrorWorkerEnvToProcessEnv(env: Record<string, unknown>): void {
  for (const key of WORKER_SECRET_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}
