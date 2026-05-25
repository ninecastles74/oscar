/**
 * Resolve Workers secrets/vars: cached fetch(env) bindings, then process.env (.dev.vars).
 */
import { getWorkerBindingsRecord } from "../news/worker-env";

export function getServerEnv(key: string): string | undefined {
  const bindings = getWorkerBindingsRecord();
  if (bindings) {
    const fromBindings = bindings[key];
    if (typeof fromBindings === "string" && fromBindings.trim()) {
      return fromBindings.trim();
    }
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

/** Which AI-related keys the Worker env object exposes (names only). */
export function listDetectedAiEnvKeys(): string[] {
  const bindings = getWorkerBindingsRecord();
  const found = new Set<string>();
  for (const key of WORKER_SECRET_ENV_KEYS) {
    if (getServerEnv(key)) found.add(key);
  }
  if (bindings) {
    for (const key of Object.keys(bindings)) {
      if (key.includes("API_KEY") || key.includes("GEMINI") || key.includes("OPENAI") || key.includes("ANTHROPIC")) {
        if (typeof bindings[key] === "string" && String(bindings[key]).trim()) found.add(key);
      }
    }
  }
  return [...found].sort();
}
