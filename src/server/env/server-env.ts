/**
 * Resolve Workers secrets — cloudflare:workers env is authoritative (TanStack Start / Workers).
 * Module bindings + process.env are fallbacks (local .dev.vars, mirrored fetch env).
 */
import { env as cloudflareEnv } from "cloudflare:workers";
import { getWorkerBindingsRecord } from "../news/worker-env";

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

function readFromRecord(record: Record<string, unknown> | null | undefined, key: string): string | undefined {
  if (!record) return undefined;
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export function getServerEnv(key: string): string | undefined {
  const fromCloudflare = readFromRecord(cloudflareEnv as Record<string, unknown>, key);
  if (fromCloudflare) return fromCloudflare;

  const fromBindings = readFromRecord(getWorkerBindingsRecord(), key);
  if (fromBindings) return fromBindings;

  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();

  return undefined;
}

export function isServerEnvTruthy(key: string): boolean {
  return !!getServerEnv(key);
}

export function isServerEnvFalse(key: string): boolean {
  return getServerEnv(key) === "false";
}

export function mirrorWorkerEnvToProcessEnv(env: Record<string, unknown>): void {
  for (const key of WORKER_SECRET_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}

/** Snapshot secrets at request time for waitUntil background work. */
export function captureWorkerEnvSnapshot(): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  const cf = cloudflareEnv as Record<string, unknown>;
  const bind = getWorkerBindingsRecord() ?? {};

  const keys = new Set<string>([
    ...WORKER_SECRET_ENV_KEYS,
    ...Object.keys(cf),
    ...Object.keys(bind),
  ]);

  for (const key of keys) {
    if (!/API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE_AI|MULTI_MODEL|SCHEDULED_USE/i.test(key)) {
      continue;
    }
    const value =
      readFromRecord(cf, key) ??
      readFromRecord(bind, key) ??
      (typeof process.env[key] === "string" ? process.env[key] : undefined);
    if (value) snap[key] = value;
  }

  return snap;
}

export function listDetectedAiEnvKeys(): string[] {
  const found = new Set<string>();
  for (const key of WORKER_SECRET_ENV_KEYS) {
    if (getServerEnv(key)) found.add(key);
  }
  const cf = cloudflareEnv as Record<string, unknown>;
  for (const key of Object.keys(cf)) {
    if (/API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE_AI/i.test(key)) {
      if (readFromRecord(cf, key)) found.add(key);
    }
  }
  return [...found].sort();
}
