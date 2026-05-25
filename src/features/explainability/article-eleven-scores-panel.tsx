import { useState } from "react";
import type { ScoreExplainability, StoryConsensusReport } from "@/types/news-platform";
import type { ArticlePageScores } from "@/types/article-page-scores";
import { articlePageScoresToExplainability } from "./article-page-scores-utils";
import { OSCAR } from "@/lib/brand";
import { ClickableScore } from "./clickable-score";
import { ScoreExplainabilitySheet } from "./score-explainability-sheet";

/** Display order for the six reliability categories on article pages. */
const CATEGORY_ORDER: { id: string; label: string; defaultWeightPercent: number }[] = [
  { id: "evidence_support", label: "Evidence Support", defaultWeightPercent: 25 },
  { id: "cross_source_corroboration", label: "Cross-Source Corroboration", defaultWeightPercent: 20 },
  { id: "context_completeness", label: "Context Completeness", defaultWeightPercent: 15 },
  { id: "contradiction_detection", label: "Contradiction Detection", defaultWeightPercent: 15 },
  { id: "sensationalism", label: "Sensationalism", defaultWeightPercent: 10 },
  { id: "source_transparency", label: "Source Transparency", defaultWeightPercent: 15 },
];

export type { ArticleStoryScores } from "@/types/article-page-scores";
import type { ArticleStoryScores } from "@/types/article-page-scores";

function withScore(
  base: ScoreExplainability,
  overallScore: number,
  label: string,
): ScoreExplainability {
  return {
    ...base,
    overallScore,
    entityLabel: `${base.entityLabel} — ${label}`,
    whyScoreExists: `${label}: ${overallScore}/100. ${base.whyScoreExists}`,
  };
}

/**
 * Eleven scores for article pages in product order:
 * story consensus (4) → weighted article → six category scores (6).
 */
export function ArticleElevenScoresPanel({
  articleExplainability,
  articlePageScores,
  articleTitle,
  storyExplainability,
  storyScores,
  storyReport,
}: {
  articleExplainability?: ScoreExplainability | null;
  /** Lean scores from server (used when full explainability is unavailable). */
  articlePageScores?: ArticlePageScores | null;
  articleTitle?: string;
  storyExplainability: ScoreExplainability | null;
  storyScores: ArticleStoryScores | null;
  storyReport?: StoryConsensusReport | null;
}) {
  const [active, setActive] = useState<ScoreExplainability | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const resolvedArticleExplainability =
    articleExplainability ??
    (articlePageScores
      ? articlePageScoresToExplainability(
          articlePageScores,
          articleTitle ?? articlePageScores.articleId,
        )
      : null);

  if (!resolvedArticleExplainability) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-6 text-center">
        <h2 className="font-serif text-2xl font-semibold">Article & story scores</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Scores are not available yet. Open the cluster consensus page or wait for scheduled
          analysis to finish.
        </p>
      </section>
    );
  }

  const open = (exp: ScoreExplainability) => {
    setActive(exp);
    setSheetOpen(true);
  };

  const effectiveStoryScores =
    storyScores ?? articlePageScores?.story ?? null;

  const stepById = new Map(
    resolvedArticleExplainability.calculationSteps.map((s) => [s.categoryId, s]),
  );
  if (articlePageScores) {
    for (const c of articlePageScores.categories) {
      if (!stepById.has(c.id)) {
        stepById.set(c.id, {
          categoryId: c.id,
          label: c.label,
          score: c.score,
          weightPercent: c.weightPercent,
          weightedContribution: Math.round((c.score * c.weightPercent) / 100),
          description: c.description ?? c.label,
          formulaSummary: c.formulaSummary ?? c.label,
        });
      }
    }
  }

  const storyBase =
    storyExplainability ??
    ({
      ...resolvedArticleExplainability,
      entityType: "story",
      entityLabel: storyReport?.title ?? "Story cluster",
      whyScoreExists: "Story-level scores require cluster consensus analysis.",
      howCalculated: "Computed from cross-source claim alignment for this story cluster.",
    } as ScoreExplainability);

  const tiles: {
    key: string;
    score: number | null;
    label: string;
    sublabel: string;
    onClick?: () => void;
    disabled?: boolean;
  }[] = [
    {
      key: "consensus",
      score: effectiveStoryScores?.consensusScore ?? null,
      label: `${OSCAR.consensus} score`,
      sublabel: "Cross-source agreement",
      onClick: effectiveStoryScores
        ? () => open(withScore(storyBase, effectiveStoryScores.consensusScore, "Consensus"))
        : undefined,
      disabled: !effectiveStoryScores,
    },
    {
      key: "dispute",
      score: effectiveStoryScores?.disputeScore ?? null,
      label: "Dispute score",
      sublabel: "Share of disputed claims",
      onClick: effectiveStoryScores
        ? () => open(withScore(storyBase, effectiveStoryScores.disputeScore, "Dispute"))
        : undefined,
      disabled: !effectiveStoryScores,
    },
    {
      key: "uncertainty",
      score: effectiveStoryScores?.uncertaintyScore ?? null,
      label: "Uncertainty score",
      sublabel: "Ambiguity and missing context",
      onClick: effectiveStoryScores
        ? () => open(withScore(storyBase, effectiveStoryScores.uncertaintyScore, "Uncertainty"))
        : undefined,
      disabled: !effectiveStoryScores,
    },
    {
      key: "story-confidence",
      score: effectiveStoryScores?.storyConfidence ?? null,
      label: "Story confidence",
      sublabel: "Overall cluster confidence",
      onClick: effectiveStoryScores
        ? () => open(withScore(storyBase, effectiveStoryScores.storyConfidence, "Story confidence"))
        : undefined,
      disabled: !effectiveStoryScores,
    },
    {
      key: "weighted-article",
      score: resolvedArticleExplainability.overallScore,
      label: "Weighted article score",
      sublabel: "Six-category composite (this article)",
      onClick: () => open(resolvedArticleExplainability),
    },
    ...CATEGORY_ORDER.map((cat) => {
      const step = stepById.get(cat.id);
      const weight = step?.weightPercent ?? cat.defaultWeightPercent;
      return {
        key: cat.id,
        score: step?.score ?? null,
        label: `${cat.label} (${weight}%)`,
        sublabel: step?.formulaSummary ?? cat.label,
        onClick: step
          ? () => {
              const stepExp: ScoreExplainability = {
                ...resolvedArticleExplainability,
                overallScore: step.score,
                entityLabel: `${resolvedArticleExplainability.entityLabel} — ${cat.label}`,
                whyScoreExists: step.description,
                howCalculated: step.formulaSummary,
                weightedFormula: `${step.score} × ${weight}% weight`,
                calculationSteps: [step],
              };
              open(stepExp);
            }
          : undefined,
        disabled: !step,
      };
    }),
  ];

  return (
    <>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-serif text-2xl font-semibold">Article & story scores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Eleven epistemic scores for this page: four story-level {OSCAR.consensus} metrics, the
          weighted reliability composite for this article, and six category inputs. Click any score
          for how it was calculated.
        </p>
        {!effectiveStoryScores && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Story scores appear after cluster consensus is available. Open the cluster consensus
            page first if scores show as unavailable.
          </p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((t) =>
            t.disabled || t.score == null ? (
              <div
                key={t.key}
                className="rounded-lg border border-dashed bg-secondary/20 px-4 py-5 text-center"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.label}
                </div>
                <div className="mt-2 font-mono text-2xl text-muted-foreground">—</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{t.sublabel}</div>
              </div>
            ) : (
              <ClickableScore
                key={t.key}
                score={t.score}
                label={t.label}
                sublabel={t.sublabel}
                onClick={t.onClick ?? (() => open(resolvedArticleExplainability))}
              />
            ),
          )}
        </div>
      </section>

      <ScoreExplainabilitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        explainability={active}
      />
    </>
  );
}
