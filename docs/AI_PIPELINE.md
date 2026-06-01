# Oscar AI Pipeline Audit

This document describes how live AI analysis runs end-to-end for **Ask Oscar** and **Top 100 news**, required configuration, and known failure modes.

## Required configuration (production)

| Requirement | Why |
|-------------|-----|
| `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`) on the **oscar** Worker | Claim extract fallback, live web evidence, Gemini corroboration |
| `FEED_KV` binding in `wrangler.jsonc` | Cross-request state for Ask Oscar polling and Top 100 feed |
| `MULTI_MODEL_VERIFICATION_ENABLED=true` | Default in wrangler; do not disable |
| `SCHEDULED_USE_MULTI_MODEL=true` | Scheduled feed analysis uses multi-model |

Recommended secrets:

- `OPENAI_API_KEY` — primary verification + claim extraction (preferred)
- `ANTHROPIC_API_KEY` — Claude review on uncertain/disputed claims

### Enable FEED_KV

```bash
npx wrangler kv namespace create OSCAR_FEED
# Uncomment kv_namespaces in wrangler.jsonc with the returned id
npx wrangler deploy
```

Without KV, Ask Oscar may spin forever (background job on one isolate, poll on another) or lose results after completion.

---

## Ask Oscar (`/analyze`) — step by step

### 1. Submit (`submitManualAnalysis`)

**Files:** `src/features/analysis/user-analysis-form.tsx` → `src/server/analysis/functions.ts`

1. Check `GEMINI_API_KEY` is configured
2. Check daily quota (`FREE_DAILY_AI_ANALYSES`, default 5)
3. Create `req_*` / `sub_*` records → KV + in-memory
4. Record quota usage
5. If KV configured → `waitUntil(executeManualAnalysis)` (background)
6. Else → run pipeline inline in submit request

### 2. Pipeline (`executeManualAnalysis` → `runManualAnalysisPipeline`)

**File:** `src/server/analysis/manual.ts`

| Step | Progress | AI | File |
|------|----------|-----|------|
| Fetch URL or parse text | 15% | — | `url-fetch.ts` / `manual.ts` |
| Extract claims | 35% | OpenAI → Gemini fallback | `extractClaimsLlm.ts` |
| Classify claims | — | Heuristic | `classifyClaims.ts` |
| Classify topics | — | Keyword + optional OpenAI | `classify-topics.ts` |
| Live web evidence | 50% | Gemini + Google Search | `retrieveEvidenceLive.ts` |
| Compare sources | — | Rules | `compareSources.ts` |
| Contradictions | — | Rules | `contradiction/` |
| Score + report | — | Rules | `scoreConfidence.ts` |
| Multi-model verify | 70% | OpenAI/Gemini primary, Claude review, Gemini corroboration | `multi-model/orchestrator.ts` |
| Live AI guard | — | — | `live-ai-guard.ts` |
| Reliability + consensus | 100% | Rules | `reliability/engine.ts` |
| Final intelligence (optional) | — | Orchestration | `build-final-intelligence.ts` |

**Wall timeout:** `MANUAL_ANALYSIS_WALL_MS` (default 300s)

**Reliability:** Stored in memory + KV (`oscar:manual:v1:rel:{requestId}`) so polling works across Worker isolates.

### 3. Live evidence (`retrieveEvidenceLive`)

**Defaults:**

- `LIVE_EVIDENCE_MAX_CLAIMS=5`
- `LIVE_EVIDENCE_BATCH_SIZE=2` — batch of 2 claims per Gemini Search call
- One single-claim retry per missing claim after batching
- Model: `GEMINI_VERIFICATION_MODEL` or `gemini-2.5-flash`

**Failure:** Any claim without evidence → pipeline stops with `LIVE_AI_REQUIRED`.

### 4. Multi-model (per claim, max 5 for user)

| Role | Provider | When |
|------|----------|------|
| Primary | OpenAI if configured, else Gemini | Always |
| Review | Anthropic if uncertain/disputed, else Gemini | Confidence &lt; 58 or disputed/unclear verdict |
| Corroboration | Gemini JSON (or Search if no live evidence) | Always |

If live web evidence exists and Gemini JSON corroboration fails, a evidence-backed fallback is used (does not block the pipeline).

### 5. Results polling (`/analyze/results`)

**File:** `src/routes/analyze.results.tsx`

Polls `getManualAnalysis` every 2s. Shows failure after ~90s stale or when status is `failed`.

---

## Top 100 news — step by step

### 1. Cron ingest (every 8h default)

**Files:** `src/server.ts` → `src/server/jobs/news/scheduled-pipeline.ts`

1. `ingestNews` — RSS/API providers → dedupe → cluster → rank Top 100
2. `mergeIngestIntoFeed` — update in-memory feed + KV snapshot
3. For each **affected Top 100 cluster** with **new articles** (max `SCHEDULED_ANALYSIS_MAX_CLUSTERS`, default 12):
   - `runHeavyweightClusterAnalysis` per cluster
4. Save feed state to KV again (consensus + page scores)

### 2. Per-article analysis (scheduled)

Same core as Ask Oscar:

- `runVerificationPipeline`
- `enrichVerificationWithMultiModel(..., "scheduled")` — capped at `SCHEDULED_MULTIMODEL_MAX_CLAIMS` (default 5)
- `assertLiveAnalysisReport`
- Reliability + claim consensus

**Input:** Feed summary/excerpt (not full user paste). Shorter text → fewer claims.

### 3. Story consensus

- `buildStoryConsensus` — align claims across cluster articles
- `enrichStoryConsensusWithGemini` — executive summary + Google Search

### 4. On-demand UI

| Route | Behavior |
|-------|----------|
| `/stories` | Loads Top 100 from KV; bootstrap ingest if empty (no AI) |
| `/consensus/$clusterId` | Loads cached consensus or runs analysis in background |

Opening a consensus page can trigger analysis if cron has not run yet.

---

## Environment variables reference

```bash
# Evidence
LIVE_EVIDENCE_MAX_CLAIMS=5
LIVE_EVIDENCE_BATCH_SIZE=2
GEMINI_VERIFICATION_MODEL=gemini-2.5-flash

# Multi-model caps
MANUAL_MULTIMODEL_MAX_CLAIMS=5
SCHEDULED_MULTIMODEL_MAX_CLAIMS=5
MANUAL_ANALYSIS_WALL_MS=300000

# Scheduled feed
SCHEDULED_NEWS_ENABLED=true
SCHEDULED_NEWS_CRON=0 */8 * * *
SCHEDULED_ANALYSIS_MAX_CLUSTERS=12
SCHEDULED_INGEST_MAX_PER_PROVIDER=50

# Rate limits (free tier)
GEMINI_MIN_REQUEST_INTERVAL_MS=4500
GEMINI_JSON_MIN_REQUEST_INTERVAL_MS=2200
```

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Infinite spinner on results | No `FEED_KV` or reliability lost between isolates | Enable KV; redeploy |
| Live evidence failed N claims | Batch too large, rate limit, empty Gemini response | Use `LIVE_EVIDENCE_BATCH_SIZE=2`; enable billing |
| Gemini corroboration failed | JSON parse failure | Fixed: evidence fallback when live evidence exists |
| Quota used but analysis failed | Was recording quota before Gemini check | Fixed: Gemini checked first |
| Top 100 has no consensus | Cron ran ingest only; analysis failed silently | Check Worker logs; verify API keys |
| Stories disappear on redeploy | KV not bound | Enable `FEED_KV` |

---

## Diagnostic endpoints

- Server fn `getAiDiagnostics` — key detection, KV status
- Server fn `testAiConnectionsFn` — smoke test OpenAI/Anthropic/Gemini

Run Ask Oscar with Worker logs open (`wrangler tail`) to see `[retrieveEvidenceLive]` and `[gemini-client]` lines.
