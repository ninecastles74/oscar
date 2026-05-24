# Supabase integration

OSCAR uses **Supabase PostgreSQL** for durable storage of articles, claims, evidence, reliability scores, and historical snapshots. The Prisma schema in `prisma/schema.prisma` matches the Supabase database tables.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Open **Project Settings → Database** and copy:
   - **Connection string (URI)** — Transaction pooler (port **6543**) for runtime
   - **Connection string (URI)** — Direct (port **5432**) for migrations

## 2. Environment variables

The repo only ships **templates** (`.env.example`, `.dev.vars.example`). Local secrets are gitignored — create them once:

```bash
npm run env:setup
# or: cp .env.example .env && cp .env.example .dev.vars
```

Then set:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Prisma / migrations (from Supabase → Database → Connection string)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

Use the **service role** key only on the server — never expose it to the browser.

## 3. Apply schema

```bash
npm run db:generate
npm run db:push
```

Or with migrations:

```bash
npm run db:migrate
```

## 4. Seed approved sources

```bash
npm run db:seed
```

## 5. Runtime behavior

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set:

- **Manual analysis** persists articles, claims, evidence, and analysis runs, then reliability scores (ordered so `article_scores` always has a parent row).
- **Reliability scoring** (all paths through `computeAndStoreReliabilityScores`) uses the same ordered `persistVerificationToSupabase` flow.
- In-memory stores still run for fast reads in the same session; Supabase is the system of record across restarts.

Check status via server function `getSupabaseStatus` or Settings in the app.

## Architecture

| Layer | Role |
|-------|------|
| `@supabase/supabase-js` | HTTP client — works on Cloudflare Workers (`nodejs_compat`) |
| Prisma | Schema definition + `db:push` / `db:migrate` from your machine |
| `src/server/supabase/` | Persistence adapters |

## Security

- Enable Row Level Security (RLS) on tables for production if you add a public client.
- Server persistence uses the **service role** key and should remain server-only.
