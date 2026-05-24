# OSCAR — Project Structure

Observational Source Consensus & Analysis Review — built on TanStack Start (React 19, Vite 7).
News ingestion, manual analysis, Supabase persistence, and reliability scoring are wired; some UI still uses mock fixtures.

## Folder map

```
src/
├── app/                  App shell: header, footer, landing, settings, nav config
├── components/           Generic, app-agnostic UI primitives
│   ├── confidence-bar.tsx
│   ├── stat-tile.tsx
│   └── ui/               shadcn/ui (untouched)
├── features/             Feature-scoped views (UI + light orchestration)
│   ├── news-monitor/     Dashboard + automated pipeline simulator
│   ├── manual-analyzer/  Paste-an-article form
│   ├── articles/         (placeholder — single-article views go here)
│   ├── claims/           ClaimPanel, VerdictBadge, EvidenceCard, detail view
│   ├── sources/          SourceBadge + admin table
│   ├── story-clusters/   Top-100 list, cluster view, source-comparison matrix
│   └── reports/          ReportView (used by manual analyzer + future routes)
├── lib/
│   ├── mock-data/        All fixture data lives here — split by domain
│   │   ├── types.ts          Source, Claim, Evidence, Story, Cluster, Verdict
│   │   ├── sources.ts        SOURCES + sourceById
│   │   ├── clusters.ts       CLUSTERS + clusterById
│   │   ├── stories.ts        STORIES + storiesForCluster
│   │   ├── claims.ts         CLAIMS + claimsForCluster
│   │   ├── manual-report.ts  MANUAL_SAMPLE_REPORT
│   │   ├── pipeline-fixtures.ts  STAGES, FEEDS, computeMetrics, samples
│   │   ├── seed.ts           Deterministic seeds shared by generators
│   │   └── index.ts          Single barrel — always import from `@/lib/mock-data`
│   └── utils.ts          `cn()` helper
├── types/
│   └── news-platform.ts  Canonical typed contracts for the future live system
├── routes/               TanStack file-based routes (DO NOT replace with src/app/)
│   └── *.tsx             Each route is a thin shell that delegates to a feature view
└── styles.css            Theme tokens (OKLCH)
```

## Architectural rules

1. **Routes are thin.** Each file in `src/routes/` only defines metadata,
   loaders, and renders one feature view. No business logic, no JSX trees.
2. **Mock data is the single source of truth for fixtures.** Import only from
   `@/lib/mock-data` — never from individual files inside that folder.
3. **Features own their UI.** Components shared across features go in
   `src/components/`. App-shell pieces go in `src/app/`.
4. **Types contract vs mock types.** `src/types/news-platform.ts` is the
   richer, future-facing contract. `src/lib/mock-data/types.ts` is the
   lightweight shape used by the current fixtures. They are intentionally
   separate so the mock layer can evolve.
5. **TanStack constraint.** Routes MUST live in `src/routes/` — this is
   required by the framework's file-based router. The `src/app/` folder is
   for app-shell components, not routes.

## Continuing in Cursor

- Add a new page: create `src/routes/<path>.tsx` as a thin shell, then put
  the actual UI in `src/features/<feature>/<page>-view.tsx`.
- Replace mock data with live calls: swap the imports inside
  `src/features/**/*` from `@/lib/mock-data` to TanStack server functions
  (`createServerFn`) that return the same `types/news-platform.ts` shapes.
- **News ingestion (server-only):** `src/server/news/` — `runNewsIngestion` and
  `getIngestionProviderStatus` in `functions.ts`. Copy `.env.example` to `.dev.vars`
  for local Cloudflare dev. Keys are read via `process.env` only on the server.
- **RSS registry:** `src/server/news/rss/` — configurable publisher feeds via
  `RSS_USE_DEFAULT_REGISTRY`, `RSS_ENABLED_FEED_IDS`, `RSS_FEEDS_JSON`. Stores
  metadata + feed summary only (`feed_summary_only`); `extractedClaims` filled later.
- **Manual analyzer:** `src/server/analysis/` — `submitManualAnalysis` (POST),
  `getManualAnalysis` (GET). Verification pipeline in `verification/`:
  extractClaims → classifyClaims → retrieveEvidence → compareSources →
  detectContradictions → detectMissingContext → scoreConfidence → generateFinalReport.
  Per-claim labels only: Supported, Disputed, Unclear, Insufficient Evidence.
- **Reliability engine:** `src/server/reliability/` — evidence-weighted scores (not
  objective truth) for articles, organizations, authors, and topics. APIs:
  `getReliabilityScores`, `recalculateReliability`. Returned on manual analysis as `reliability` JSON.
- **PostgreSQL / Prisma:** `prisma/schema.prisma` — production schema for articles,
  claims, evidence, score tables, and `historical_score_snapshots` time-series.
- New shared widget: drop it in `src/components/` (no feature coupling).
