/**
 * Resolve Workers secrets — cloudflare:workers env + mirrored fetch bindings.
 * Normalizes malformed binding names (e.g. "GEMINI_API_KEY=" → "GEMINI_API_KEY").
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
  valueLength?: number;
  /** Raw binding name when it differs from normalized key (e.g. trailing "="). */
  rawKey?: string;
}

/** Strip whitespace and trailing "=" from secret/variable names. */
export function normalizeEnvKey(key: string): string {
  return key.trim().replace(/=+$/, "");
}

function readRawFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): { value?: string; rawKey?: string } {
  if (!record) return {};
  const target = normalizeEnvKey(key);
  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (normalizeEnvKey(rawKey) !== target) continue;
    if (typeof rawValue === "string" && rawValue.trim()) {
      return { value: rawValue.trim(), rawKey: rawKey !== target ? rawKey : undefined };
    }
  }
  return {};
}

function mergeStringEnvInto(target: Record<string, unknown>, record: Record<string, unknown> | null | undefined) {
  if (!record) return;
  for (const [rawKey, value] of Object.entries(record)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const key = normalizeEnvKey(rawKey);
    if (!target[key]) target[key] = value.trim();
  }
}

export function getServerEnv(key: string): string | undefined {
  const target = normalizeEnvKey(key);

  const fromCloudflare = readRawFromRecord(cloudflareEnv as Record<string, unknown>, target);
  if (fromCloudflare.value) return fromCloudflare.value;

  const fromBindings = readRawFromRecord(getWorkerBindingsRecord(), target);
  if (fromBindings.value) return fromBindings.value;

  for (const [rawKey, rawValue] of Object.entries(process.env)) {
    if (normalizeEnvKey(rawKey) !== target) continue;
    if (typeof rawValue === "string" && rawValue.trim()) return rawValue.trim();
  }

  return undefined;
}

export function isServerEnvTruthy(key: string): boolean {
  return !!getServerEnv(key);
}

export function isServerEnvFalse(key: string): boolean {
  return getServerEnv(key) === "false";
}

export function mirrorWorkerEnvToProcessEnv(env: Record<string, unknown>): void {
  for (const [rawKey, value] of Object.entries(env)) {
    if (typeof value !== "string" || !value.trim()) continue;
    process.env[normalizeEnvKey(rawKey)] = value.trim();
  }
}

export function auditSecretBindings(): SecretBindingAudit[] {
  const cf = cloudflareEnv as Record<string, unknown>;
  const bind = getWorkerBindingsRecord() ?? {};
  const byCanonical = new Map<string, SecretBindingAudit>();

  const consider = (rawKey: string, record: Record<string, unknown>) => {
    if (!/API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE_AI|GOOGLE_API/i.test(rawKey)) return;
    const canonical = normalizeEnvKey(rawKey);
    const rawValue = record[rawKey];
    const hasValue = typeof rawValue === "string" && rawValue.trim().length > 0;
    const existing = byCanonical.get(canonical);

    if (hasValue) {
      const entry: SecretBindingAudit = {
        key: canonical,
        status: "ok",
        valueLength: (rawValue as string).trim().length,
        rawKey: rawKey !== canonical ? rawKey : undefined,
      };
      if (!existing || existing.status !== "ok") byCanonical.set(canonical, entry);
      return;
    }

    if (!existing) {
      byCanonical.set(canonical, {
        key: canonical,
        status: rawKey in record ? "empty" : "missing",
        rawKey: rawKey !== canonical ? rawKey : undefined,
      });
    }
  };

  for (const key of Object.keys(cf)) consider(key, cf);
  for (const key of Object.keys(bind)) consider(key, bind);

  for (const key of ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const) {
    if (byCanonical.has(key)) continue;
    const v = getServerEnv(key);
    byCanonical.set(key, v ? { key, status: "ok", valueLength: v.length } : { key, status: "missing" });
  }

  return [...byCanonical.values()].sort((a, b) => a.key.localeCompare(b.key));
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
    .filter((a) => a.status === "ok" && /API_KEY|GEMINI|OPENAI|ANTHROPIC|GOOGLE/i.test(a.key))
    .map((a) => a.key);
}

export function listMalformedEnvKeyAliases(): string[] {
  return auditSecretBindings()
    .filter((a) => a.rawKey)
    .map((a) => a.rawKey as string);
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
    .map(([k]) => normalizeEnvKey(k))
    .sort();
}

export function hasAnyAiApiKey(snapshot?: Record<string, unknown>): boolean {
  const aiKeys = [
    "GEMINI_API_KEY",
    "GOOGLE_AI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_KEYS",
    "ANTHROPIC_API_KEY",
  ];
  const snap = snapshot ?? captureWorkerEnvSnapshot();
  return aiKeys.some((k) => typeof snap[k] === "string" && String(snap[k]).trim().length > 8);
}
