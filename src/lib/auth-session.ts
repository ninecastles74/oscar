import { getSupabaseBrowser } from "./supabase-browser";

export async function getAccessToken(): Promise<string | undefined> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
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
