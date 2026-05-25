# Cloudflare setup — live Top 100 news feed

The Top 100 page reads from a **persisted feed**, not from Supabase. Ingest runs on a schedule (every 8 hours) and when `/stories` loads with an empty feed.

## Why articles were missing

Cloudflare Workers **do not keep in-memory data** between requests. The feed used to live only in RAM, so:

1. Cron could ingest successfully, then the next visitor hit a **different isolate** with an empty feed.
2. `/stories` fell back to **mock data**, which looks frozen.

The app now saves the feed to **Workers KV** (`FEED_KV` binding).

---

## One-time: KV namespace

```bash
cd /path/to/oscar
npx wrangler kv namespace create OSCAR_FEED
```

Copy the returned **id** into `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "FEED_KV",
    "id": "YOUR_NAMESPACE_ID_HERE"
  }
]
```

Redeploy after updating `wrangler.jsonc`.

---

## Cloudflare dashboard — variable types

| Variable | Type in Workers | Notes |
|----------|-----------------|-------|
| `RSS_USE_DEFAULT_REGISTRY` | **Text** | Set to `true` so RSS works without paid API keys |
| `NEWS_INGEST_ENABLED_PROVIDERS` | **Text** | e.g. `rss` or `rss,newsapi,gnews,guardian` |
| `NEWS_INGEST_COUNTRY` | **Text** | e.g. `us` |
| `NEWS_INGEST_LANGUAGE` | **Text** | e.g. `en` |
| `SCHEDULED_NEWS_ENABLED` | **Text** | `true` (omit or anything except `false`) |
| `SCHEDULED_NEWS_CRON` | **Text** | Leave **unset** unless you change `wrangler.jsonc` crons |
| `NEWS_API_KEY` | **Secret** | NewsAPI.org |
| `GNEWS_API_KEY` | **Secret** | GNews |
| `GUARDIAN_API_KEY` | **Secret** | Guardian Open Platform |
| `CRON_SECRET` | **Secret** | Optional; for manual ingest API only |
| `SUPABASE_URL` | **Text** | Not required for Top 100 ingest |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Not required for Top 100 ingest |

**Minimum working setup (no paid news APIs):**

```text
RSS_USE_DEFAULT_REGISTRY=true
NEWS_INGEST_ENABLED_PROVIDERS=rss
SCHEDULED_NEWS_ENABLED=true
```

---

## Cron

`wrangler.jsonc` includes `0 */8 * * *` for news ingest.

- Do **not** set `SCHEDULED_NEWS_CRON` unless it **exactly** matches that expression.
- Set `SCHEDULED_NEWS_ENABLED=false` only if you want to disable automatic ingest.

Check **Workers → your worker → Logs** after a cron run for:

`[scheduled] news pipeline {"newArticles":...}`

---

## After deploy

1. Confirm KV binding `FEED_KV` exists on the worker.
2. Open **`/stories`** — first visit triggers **bootstrap ingest** if the feed is empty (15‑minute cooldown between attempts).
3. You should see **“Last ingest …”** under the title when the live feed is active (not mock).

---

## Manual test (optional)

With `CRON_SECRET` set, POST to your worker’s server function or use local:

```bash
# Local with .dev.vars filled in
npm run dev
```

Then trigger scheduled refresh from the app’s server layer or wait for cron.

---

## Supabase

Top 100 **ingest does not write to Supabase**. Supabase is used for analysis persistence after Ask Oscar / verification. Empty Supabase does **not** block the news feed.
