import { createServerFn } from "@tanstack/react-start";
import { checkSupabaseConnection, getSupabaseAdmin } from "./client";
import { isPrismaConfigured, isSupabaseConfigured } from "./config";
import { seedApprovedSources } from "./seed-sources";

/** Health check for Supabase connection and schema. */
export const getSupabaseStatus = createServerFn({ method: "GET" }).handler(async () => {
  const configured = isSupabaseConfigured();
  const prismaConfigured = isPrismaConfigured();
  if (!configured) {
    return {
      configured: false,
      prismaConfigured,
      ok: false,
      message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .dev.vars",
    };
  }
  const check = await checkSupabaseConnection();
  return {
    configured: true,
    prismaConfigured,
    ok: check.ok,
    message: check.message,
    hasClient: !!getSupabaseAdmin(),
  };
});

/** Seed approved sources into Supabase (admin). */
export const seedSupabaseSources = createServerFn({ method: "POST" }).handler(async () => {
  const result = await seedApprovedSources();
  if (result.error) {
    return { error: { code: "SEED_FAILED", message: result.error } };
  }
  return { count: result.count };
});
