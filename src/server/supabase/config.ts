/**
 * Supabase configuration — server-only env vars (never VITE_ prefix).
 */
export function isSupabaseConfigured(): boolean {
  if (process.env.SUPABASE_ENABLED === "false") return false;
  const url = process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim();
}

export function getSupabaseServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim()
  );
}

export function isPrismaConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
