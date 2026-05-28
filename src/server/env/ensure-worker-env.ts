import { env as cloudflareEnv } from "cloudflare:workers";
import { mirrorWorkerEnvToProcessEnv } from "./server-env";
import { getWorkerBindingsRecord, setWorkerBindings } from "../news/worker-env";

/** Call at every AI entry point (Ask Oscar, scheduled cron, feed consensus). */
export function ensureWorkerEnvFromPlatform(): Record<string, unknown> {
  const cf = cloudflareEnv as Record<string, unknown>;
  const prev = getWorkerBindingsRecord() ?? {};
  const merged: Record<string, unknown> = { ...prev };
  for (const [key, value] of Object.entries(cf)) {
    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim();
    }
  }
  setWorkerBindings(merged);
  mirrorWorkerEnvToProcessEnv(merged);
  return merged;
}
