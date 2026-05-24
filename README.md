# OSCAR

**Observational Source Consensus & Analysis Review** — AI-powered news verification: cross-source clustering, claim analysis, evidence weighting, and reliability scoring.

## Product phrases

| Label | Use |
|-------|-----|
| **OSCAR** | Brand name (UI, docs, package) |
| **Ask Oscar** | Manual article analysis |
| **Oscar Signals** | Dashboard / live monitor |
| **Oscar Analysis** | Reports and verification output |
| **Oscar Consensus** | Cross-source agreement |
| **Oscar Intelligence** | Platform tagline |

Branding constants live in [`src/lib/brand.ts`](src/lib/brand.ts).

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19 + Vite 7
- Cloudflare Workers (`nodejs_compat`)
- Supabase PostgreSQL + Prisma
- Optional: NewsAPI, GNews, Guardian, RSS ingestion

## Quick start

```bash
npm install
npm run env:setup   # creates .env and .dev.vars from templates
# Fill in API keys and Supabase URLs in .env / .dev.vars
npm run db:push
npm run db:seed
npm run dev
```

See [docs/SUPABASE.md](docs/SUPABASE.md) for database setup.

## Usage & scheduling

- **Top 100 news** ingests every **8 hours** and runs **full multi-model cluster analysis** only on **new** articles; stories stay in the feed until they age out of the Top 100 slots (by date/rank). Does not use user AI quota.
- **Ask Oscar** (`/analyze`) and **My Writing** (`/my-writing`) share a daily AI limit (default **5/day** free; Pro/Team when signed in).
- **Sign in** (`/login`) is only required for paid tiers ([`/pricing`](pricing)).
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same as Supabase dashboard anon key) for browser login.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run db:push` | Apply Prisma schema to Supabase |
| `npm run db:seed` | Seed approved sources |
| `npm run env:setup` | Copy env templates |

## Project layout

See [`src/README.md`](src/README.md) for the `src/` folder map.

## License

Private — all rights reserved unless otherwise noted.
