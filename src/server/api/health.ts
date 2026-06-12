import { isGoogleAiConfigured } from "../ai/google-api-key";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { getServerEnv, listApiKeyEnvNames } from "../env/server-env";
import { feedKvStatus } from "../news/feed-persist";
import { getFeedMeta } from "../news/feed-store";
import { isSupabaseConfigured } from "../supabase/config";
import { checkSupabaseConnection as pingSupabase, getSupabaseAdmin } from "../supabase/client";

const SUPABASE_TABLE_CHECKS = [
  "sources",
  "articles",
  "analysis_runs",
  "claims",
  "claim_evidence",
  "article_scores",
] as const;

async function checkSupabaseTables(): Promise<Record<string, { ok: boolean; message?: string }>> {
  const client = getSupabaseAdmin();
  const results: Record<string, { ok: boolean; message?: string }> = {};
  if (!client) {
    for (const table of SUPABASE_TABLE_CHECKS) {
      results[table] = { ok: false, message: "Supabase not configured" };
    }
    return results;
  }
  for (const table of SUPABASE_TABLE_CHECKS) {
    const { error } = await client.from(table).select("id").limit(1);
    results[table] = error
      ? { ok: false, message: error.message }
      : { ok: true };
  }
  return results;
}

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
  let supabaseTables: Record<string, { ok: boolean; message?: string }> | undefined;

  if (!isSupabaseConfigured()) {
    supabase = {
      configured: false,
      ok: false,
      message: "Supabase not configured (optional for Top 100; set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to persist analyses).",
    };
  } else {
    const ping = await pingSupabase();
    supabaseTables = await checkSupabaseTables();
    const tablesOk = Object.values(supabaseTables).every((t) => t.ok);
    supabase = {
      configured: true,
      ok: ping.ok && tablesOk,
      message: ping.ok
        ? tablesOk
          ? "Connected; core tables reachable."
          : "Connected but some tables are missing — run npm run db:push."
        : ping.message,
    };
    console.log("[api/health] Supabase ping:", ping.ok ? "ok" : ping.message);
  }

  const newsIngestReady =
    getServerEnv("RSS_USE_DEFAULT_REGISTRY") === "true" ||
    Boolean(getServerEnv("NEWS_API_KEY") || getServerEnv("GNEWS_API_KEY") || getServerEnv("GUARDIAN_API_KEY"));

  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    geminiConfigured: isGoogleAiConfigured(),
    analysisReady: isGoogleAiConfigured(),
    feedReady: kv.configured && (feedMeta.top100Count ?? 0) > 0,
    aiKeysDetected: listApiKeyEnvNames(),
    feedKv: kv,
    feedMeta,
    supabase,
    supabaseTables,
    envPresent,
    newsIngestReady,
    recommendations: [
      !isGoogleAiConfigured()
        ? "Set GEMINI_API_KEY secret on the oscar Worker (required for Ask Oscar and article analysis)."
        : null,
      !kv.configured
        ? "Create FEED_KV namespace and add binding in wrangler.jsonc (required for Top 100 persistence)."
        : null,
      (feedMeta.top100Count ?? 0) === 0
        ? "Visit /stories after deploy to bootstrap RSS ingest, or wait for the 8h cron."
        : null,
      !supabase.configured
        ? "Optional: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to persist analyses to Supabase."
        : null,
    ].filter(Boolean),
  };
}
