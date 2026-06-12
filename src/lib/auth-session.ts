import { getSupabaseBrowser } from "./supabase-browser";

const SESSION_LOOKUP_MS = 4_000;

/** Never block analysis UI on a slow or unreachable Supabase auth session. */
export async function getAccessToken(): Promise<string | undefined> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return undefined;
  try {
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>>((resolve) =>
        setTimeout(() => resolve({ data: { session: null }, error: null }), SESSION_LOOKUP_MS),
      ),
    ]);
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowser();
  if (!supabase) throw new Error("Auth is not configured.");
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  await supabase.auth.signOut();
}
