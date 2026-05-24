import { getSupabaseAdmin } from "../supabase/client";

export interface AuthUser {
  id: string;
  email?: string;
}

export async function verifyAccessToken(
  accessToken?: string,
): Promise<{ user: AuthUser } | null> {
  const token = accessToken?.trim();
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}

export async function upsertAppUser(user: AuthUser): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !user.email) return;

  await supabase.from("app_users").upsert(
    {
      id: user.id,
      email: user.email,
      tier: "free",
    },
    { onConflict: "id" },
  );
}
