# Veridict PostgreSQL / Prisma

Evidence-weighted reliability storage — **not** objective truth declarations.

## Setup

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/veridict?schema=public"

npm install prisma @prisma/client --save-dev
npx prisma generate
npx prisma migrate dev --name init_reliability
```

## Tables

| Table | Purpose |
|-------|---------|
| `sources` | News organizations |
| `authors` | Byline authors |
| `story_clusters` | Event groupings |
| `articles` | Normalized articles (`analysis_version` for recalc) |
| `analysis_runs` | Verification runs linking claims + scores |
| `claims` | Per-claim verdicts (`is_current`, `version`) |
| `claim_evidence` | Citations with stance + URL |
| `article_scores` | Weighted category scores + rolling fields |
| `source_scores` | Organization scores per topic |
| `author_scores` | Author scores per topic |
| `topic_scores` | Category-level aggregates |
| `historical_score_snapshots` | Time-series: overall, confidence, contradictions, categories |

## Recalculation pattern

1. Bump `articles.analysis_version` when content changes.
2. Set prior `claims.is_current = false`, `article_scores.is_current = false`.
3. Insert new `analysis_run` → claims → evidence → scores (new `version`).
4. Append `historical_score_snapshots` rows for confidence/contradiction trends.

## Rolling averages

Query recent snapshots:

```sql
SELECT AVG(score_value)
FROM historical_score_snapshots
WHERE entity_type = 'source' AND entity_id = $1
  AND metric_type = 'overall_score'
  AND recorded_at >= NOW() - INTERVAL '30 days';
```

Or read denormalized `rolling_average` on `*_scores` where `is_current = true`.
