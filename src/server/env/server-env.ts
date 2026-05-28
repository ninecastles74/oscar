/**
 * Resolve Workers secrets — cloudflare:workers env + mirrored fetch bindings.
 */
import { env as cloudflareEnv } from "cloudflare:workers";
import { getWorkerBindingsRecord } from "../news/worker-env";

export const WORKER_SECRET_ENV_KEYS = [
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_KEYS",
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

export type SecretBindingStatus = "ok" | "empty" | "missing";

export interface SecretBindingAudit {
  key: string;
  status: SecretBindingStatus;
  /** Length of secret value (never the value itself). */
  valueLength?: number;
}

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

/** Keys present on the binding object (including empty-string placeholders). */
export function auditSecretBindings(): SecretBindingAudit[] {
  const cf = cloudflareEnv as Record<string, unknown>;
  const bind = getWorkerBindingsRecord() ?? {};
  const names = new Set<string>([
    ...WORKER_SECRET_ENV_KEYS,
    ...Object.keys(cf),
    ...Object.keys(bind),
  ]);

  const audits: SecretBindingAudit[] = [];
  for (const key of names) {
    if (!/API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE_AI|GOOGLE_API/i.test(key)) continue;

    const rawCf = cf[key];
    const rawBind = bind[key];
    const resolved = readFromRecord(cf, key) ?? readFromRecord(bind, key);

    const hasEmptyPlaceholder =
      (typeof rawCf === "string" && !rawCf.trim()) ||
      (typeof rawBind === "string" && !rawBind.trim());

    if (resolved) {
      audits.push({ key, status: "ok", valueLength: resolved.length });
    } else if (hasEmptyPlaceholder || key in cf || key in bind) {
      audits.push({ key, status: "empty" });
    }
  }

  const seen = new Set(audits.map((a) => a.key));
  for (const key of ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const) {
    if (!seen.has(key) && !getServerEnv(key)) {
      audits.push({ key, status: "missing" });
    }
  }

  return audits.sort((a, b) => a.key.localeCompare(b.key));
}

export function captureWorkerEnvSnapshot(): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  mergeStringEnvInto(snap, getWorkerBindingsRecord());
  mergeStringEnvInto(snap, cloudflareEnv as Record<string, unknown>);
  for (const key of WORKER_SECRET_ENV_KEYS) {
    const v = getServerEnv(key);
    if (v) snap[key] = v;
  }
  return snap;
}

export function listDetectedAiEnvKeys(): string[] {
  return auditSecretBindings()
    .filter((a) => a.status === "ok")
    .map((a) => a.key);
}

export function listApiKeyEnvNames(snapshot?: Record<string, unknown>): string[] {
  const snap = snapshot ?? captureWorkerEnvSnapshot();
  return Object.entries(snap)
    .filter(
      ([k, v]) =>
        typeof v === "string" &&
        v.trim().length > 0 &&
        /API_KEY|GEMINI|GOOGLE_AI|GOOGLE_API|OPENAI|ANTHROPIC/i.test(k),
    )
    .map(([k]) => k)
    .sort();
}

export function hasAnyAiApiKey(snapshot?: Record<string, unknown>): boolean {
  const aiKeys = ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENAI_API_KEY", "OPENAI_KEYS", "ANTHROPIC_API_KEY"];
  const snap = snapshot ?? captureWorkerEnvSnapshot();
  return aiKeys.some((k) => typeof snap[k] === "string" && String(snap[k]).trim().length > 8);
}
