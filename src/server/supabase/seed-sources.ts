import { APPROVED_SOURCES } from "../analysis/sources";
import { getSupabaseAdmin } from "./client";
import { toDbBias } from "./mappers";

/** Upsert approved outlet registry into Supabase `sources` table. */
export async function seedApprovedSources(): Promise<{ count: number; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { count: 0, error: "Supabase not configured" };

  const rows = APPROVED_SOURCES.map((s) => ({
    slug: s.id,
    name: s.name,
    domain: s.domain,
    bias: toDbBias(s.bias),
    reliability: s.reliability,
    approved: s.approved,
    language: "en",
  }));

  const { error } = await supabase.from("sources").upsert(rows, { onConflict: "slug" });
  if (error) return { count: 0, error: error.message };
  return { count: rows.length };
}
