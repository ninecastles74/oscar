/**
 * Resolve Workers secrets — cloudflare:workers env + mirrored fetch bindings.
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

function mergeStringEnvInto(target: Record<string, unknown>, record: Record<string, unknown> | null | undefined) {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.trim()) {
      target[key] = value.trim();
    }
  }
}

export function getServerEnv(key: string): string | undefined {
  const fromCloudflare = readFromRecord(cloudflareEnv as Record<string, unknown>, key);
  if (fromCloudflare) return fromCloudflare;

  const bind = getWorkerBindingsRecord();
  const fromBindings = readFromRecord(bind, key);
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
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.trim()) {
      process.env[key] = value;
    }
  }
}

export function captureWorkerEnvSnapshot(): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  // Bindings from src/server.ts fetch(env) are the most reliable in TanStack Start.
  mergeStringEnvInto(snap, getWorkerBindingsRecord());
  mergeStringEnvInto(snap, cloudflareEnv as Record<string, unknown>);
  for (const key of WORKER_SECRET_ENV_KEYS) {
    const v = getServerEnv(key);
    if (v) snap[key] = v;
  }
  return snap;
}

export function listDetectedAiEnvKeys(): string[] {
  const found = new Set<string>();
  for (const key of WORKER_SECRET_ENV_KEYS) {
    if (getServerEnv(key)) found.add(key);
  }
  mergeStringEnvInto(
    Object.fromEntries([...found].map((k) => [k, "x"])),
    cloudflareEnv as Record<string, unknown>,
  );
  const snap = captureWorkerEnvSnapshot();
  for (const key of Object.keys(snap)) {
    if (/API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE_AI/i.test(key)) found.add(key);
  }
  return [...found].sort();
}

export function listApiKeyEnvNames(snapshot?: Record<string, unknown>): string[] {
  const snap = snapshot ?? captureWorkerEnvSnapshot();
  return Object.keys(snap).filter((k) => /API_KEY|GEMINI|GOOGLE_AI|OPENAI|ANTHROPIC/i.test(k)).sort();
}

export function hasAnyAiApiKey(snapshot?: Record<string, unknown>): boolean {
  const snap = snapshot ?? captureWorkerEnvSnapshot();
  return listApiKeyEnvNames(snap).length > 0;
}
