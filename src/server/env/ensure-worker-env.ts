import { env as cloudflareEnv } from "cloudflare:workers";
import { mirrorWorkerEnvToProcessEnv, normalizeEnvKey } from "./server-env";
import { getWorkerBindingsRecord, setWorkerBindings } from "../news/worker-env";

/** Call at every AI entry point (Ask Oscar, scheduled cron, feed consensus). */
export function ensureWorkerEnvFromPlatform(): Record<string, unknown> {
  const cf = cloudflareEnv as Record<string, unknown>;
  const prev = getWorkerBindingsRecord() ?? {};
  // Preserve KV / Durable Object bindings from the Worker fetch handler.
  const merged: Record<string, unknown> = { ...prev };

  for (const [rawKey, value] of Object.entries(cf)) {
    if (typeof value === "string" && value.trim()) {
      merged[normalizeEnvKey(rawKey)] = value.trim();
    } else if (value != null && typeof value !== "string") {
      merged[rawKey] = value;
    }
  }

  setWorkerBindings(merged);
  mirrorWorkerEnvToProcessEnv(merged);
  return merged;
}
