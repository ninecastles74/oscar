import { useState } from "react";
import type { ScoreExplainability } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { ClickableScore } from "./clickable-score";
import { ScoreExplainabilitySheet } from "./score-explainability-sheet";

export function StoryScoresPanel({
  storyExplainability,
  consensusScore,
  disputeScore,
  uncertaintyScore,
  storyConfidence,
}: {
  storyExplainability: ScoreExplainability;
  consensusScore: number;
  disputeScore: number;
  uncertaintyScore: number;
  storyConfidence: number;
}) {
  const [active, setActive] = useState<ScoreExplainability | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = (exp: ScoreExplainability) => {
    setActive(exp);
    setSheetOpen(true);
  };

  const withScore = (base: ScoreExplainability, overallScore: number, label: string): ScoreExplainability => ({
    ...base,
    overallScore,
    entityLabel: `${base.entityLabel} — ${label}`,
    whyScoreExists: `${label}: ${overallScore}/100. ${base.whyScoreExists}`,
  });

  return (
    <>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-serif text-2xl font-semibold">{OSCAR.consensus} transparency</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click any score for &ldquo;Why this score?&rdquo; — how it was generated, contributing
          evidence, and what reduced confidence
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ClickableScore
            score={consensusScore}
            label={`${OSCAR.consensus} score`}
            sublabel="Cross-source agreement"
            onClick={() => open(withScore(storyExplainability, consensusScore, "Consensus"))}
          />
          <ClickableScore
            score={disputeScore}
            label="Dispute score"
            sublabel="Share of disputed claims"
            onClick={() => open(withScore(storyExplainability, disputeScore, "Dispute"))}
          />
          <ClickableScore
            score={uncertaintyScore}
            label="Uncertainty score"
            sublabel="Ambiguity and missing context"
            onClick={() => open(withScore(storyExplainability, uncertaintyScore, "Uncertainty"))}
          />
          <ClickableScore
            score={storyConfidence}
            label="Story confidence"
            sublabel="Overall cluster confidence"
            onClick={() => open(storyExplainability)}
          />
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
