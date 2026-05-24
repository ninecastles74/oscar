/**
 * Seed Supabase sources + verify connection.
 * Usage: export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-supabase.ts
 */
const { checkSupabaseConnection, seedApprovedSources, isSupabaseConfigured } =
  await import("../src/server/supabase/index.ts");

async function main() {
  if (!isSupabaseConfigured()) {
    console.error("Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const check = await checkSupabaseConnection();
  console.log(check.message);
  if (!check.ok) {
    console.error("Run: npm run db:push  (with DATABASE_URL / DIRECT_URL from Supabase)");
    process.exit(1);
  }
  const seed = await seedApprovedSources();
  console.log(`Seeded ${seed.count} sources.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
