import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceKey, getSupabaseUrl, isSupabaseConfigured } from "./config";

let adminClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client (server only). Bypasses RLS for persistence.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!adminClient) {
    const url = getSupabaseUrl()!;
    const key = getSupabaseServiceKey()!;
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export async function checkSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { ok: false, message: "Supabase not configured (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." };
  }
  const { error } = await client.from("sources").select("id").limit(1);
  if (error) {
    return {
      ok: false,
      message: `Supabase reachable but schema may be missing: ${error.message}. Run npm run db:push.`,
    };
  }
  return { ok: true, message: "Connected to Supabase PostgreSQL." };
}
