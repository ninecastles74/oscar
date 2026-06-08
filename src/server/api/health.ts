import { isGoogleAiConfigured } from "../ai/google-api-key";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { getServerEnv, listApiKeyEnvNames } from "../env/server-env";
import { feedKvStatus } from "../news/feed-persist";
import { getFeedMeta } from "../news/feed-store";
import { isSupabaseConfigured } from "../supabase/config";
import { checkSupabaseConnection as pingSupabase } from "../supabase/client";

const REQUIRED_ENV_FLAGS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "NEWS_API_KEY",
  "GNEWS_API_KEY",
  "GUARDIAN_API_KEY",
] as const;

export async function buildHealthPayload() {
  console.log("[api/health] route hit");
  ensureWorkerEnvFromPlatform();

  const envPresent: Record<string, boolean> = {};
  for (const key of REQUIRED_ENV_FLAGS) {
    envPresent[key] = !!getServerEnv(key);
  }

  const kv = feedKvStatus();
  const feedMeta = getFeedMeta();
  let supabase: { configured: boolean; ok: boolean; message: string };

  if (!isSupabaseConfigured()) {
    supabase = {
      configured: false,
      ok: false,
      message: "Supabase not configured (optional for Top 100; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to persist analyses).",
    };
  } else {
    const ping = await pingSupabase();
    supabase = { configured: true, ok: ping.ok, message: ping.message };
    console.log("[api/health] Supabase ping:", ping.ok ? "ok" : ping.message);
  }

  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    geminiConfigured: isGoogleAiConfigured(),
    aiKeysDetected: listApiKeyEnvNames(),
    feedKv: kv,
    feedMeta,
    supabase,
    envPresent,
  };
}
