# Usage limits & scheduled news

## What counts toward your daily AI quota

Only user-initiated flows:

- **Ask Oscar** (`/analyze`) — URL or pasted article

## What does NOT count

- **Top 100** automatic ingest + **heavyweight** cluster analysis (every **8 hours** via Cloudflare cron)
- Reliability score maintenance jobs

Scheduled news uses the **full** verification pipeline including **multi-model** AI, but only for **new articles** added since the last run. Existing analyzed articles are kept until they age out of the Top 100 feed (max 100 clusters, ranked by recency and source quality).

## Tiers (defaults)

| Tier | Daily AI analyses | Login |
|------|-------------------|-------|
| Free | 5 | Optional |
| Pro | 30 | Required |
| Team | 100 | Required |

Override with `FREE_TIER_DAILY_AI_LIMIT`, `PRO_TIER_DAILY_AI_LIMIT`, `TEAM_TIER_DAILY_AI_LIMIT`.

## Auth & upgrades

1. Enable Supabase Auth (email/password) in your Supabase project.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and `.dev.vars`.
3. Run `npm run db:push` to create `app_users` and `analysis_usage` tables.
4. Users sign in at `/login` and upgrade at `/pricing` (dev placeholder — wire Stripe for production).

## Cron

`wrangler.jsonc` includes `0 */8 * * *` for scheduled news. Disable with `SCHEDULED_NEWS_ENABLED=false`.

Manual ingest API (`runNewsIngestion`) requires `CRON_SECRET` when that env var is set.
