import { useState } from "react";
import type { AnalysisExplainabilityBundle } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { ClickableScore } from "./clickable-score";
import { ScoreExplainabilitySheet } from "./score-explainability-sheet";
import type { ScoreExplainability } from "@/types/news-platform";

export function ReliabilityScoresPanel({
  explainability,
}: {
  explainability: AnalysisExplainabilityBundle;
}) {
  const [active, setActive] = useState<ScoreExplainability | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const open = (exp: ScoreExplainability) => {
    setActive(exp);
    setSheetOpen(true);
  };

  return (
    <>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-serif text-2xl font-semibold">{OSCAR.reliability}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Why this score? Click any score to see how it was generated, contributing evidence, and
          what reduced confidence
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ClickableScore
            score={explainability.article.overallScore}
            label="Article reliability"
            sublabel="Weighted category composite"
            onClick={() => open(explainability.article)}
          />
          {explainability.source && (
            <ClickableScore
              score={explainability.source.overallScore}
              label="Source reliability"
              sublabel={explainability.source.entityLabel}
              onClick={() => open(explainability.source!)}
            />
          )}
          {explainability.author && (
            <ClickableScore
              score={explainability.author.overallScore}
              label="Author reliability"
              sublabel={explainability.author.entityLabel}
              onClick={() => open(explainability.author!)}
            />
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
