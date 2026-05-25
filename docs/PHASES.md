# OSCAR build phases (13–22)

Phases are engineering milestones for the verification stack. Epistemic outputs use **Supported | Disputed | Unclear | Insufficient Evidence** only — never objective truth labels.

| Phase | Capability | Server path | Service facade | UI / API |
|-------|------------|-------------|----------------|----------|
| **13** | Evidence weighting & primary evidence | `src/server/evidence-weighting/` | `src/services/evidence-weighting/`, `primary-evidence-prioritization/` | Claim panels, verification pipeline |
| **14** | Source chain / source intelligence | `src/server/source-chain/`, `source-intelligence/` | `src/services/source-intelligence/` | `ClaimResearchPanel`, `traceClaimSourceChain` |
| **15** | Contradiction analysis | `src/server/contradiction/` | `src/services/contradiction-analysis/` | `ContradictionPanel`, verification |
| **16** | Narrative & framing intelligence | `src/server/consensus/narrative-analysis.ts`, `framing-intelligence/` | `narrative-analysis/`, `narrative-framing-intelligence/` | Story consensus sections |
| **17** | Story & claim consensus | `src/server/consensus/`, `consensus-engine/` | `story-consensus/`, `consensus-engine/` | `/consensus/$clusterId`, `/stories` |
| **18** | Historical reliability | `src/server/reliability/historical/`, `analytics/` | `historical-reliability/` | Explainability, Prisma snapshots |
| **19** | Dynamic historical reliability | `src/server/reliability/dynamic-historical/` | `dynamic-historical-reliability/` | Programmatic reports (cron-ready) |
| **20** | Hallucination detection | `src/server/hallucination-detection/` | `hallucination-detection/` | Final intelligence + multi-model |
| **21** | Explainability & transparency | `reliability/explainability/`, `transparency-explainability/` | `explainability/`, `transparency-explainability/` | `/analyze/results`, consensus scores |
| **22** | Multi-model, orchestration, final intelligence | `multi-model/`, `orchestration/` | `multi-model-consensus/`, `orchestration/` | `runFinalIntelligenceOrchestration`, manual final scores |

## Persistence (Supabase / Prisma)

- Tables: `articles`, `claims`, `claim_evidence`, `analysis_runs`, `*_scores`, `historical_score_snapshots`, `app_users`, `analysis_usage`
- Story consensus: in-memory + **Workers KV** (`FEED_KV`), not Postgres

## Cloudflare

- Worker entry: `src/server.ts`, `nodejs_compat`
- Feed: bind `FEED_KV` in `wrangler.jsonc` (see `docs/CLOUDFLARE_NEWS_SETUP.md`)
- Secrets via dashboard — **not** in `wrangler.jsonc`

## Structured JSON

All server engines return typed objects (`AnalysisReport`, `StoryConsensusReport`, `FinalIntelligenceReport`, etc.) with `disclaimer` fields where scores are shown.
