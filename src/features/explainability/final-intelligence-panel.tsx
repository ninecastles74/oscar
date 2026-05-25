import type { FinalIntelligenceSummary } from "@/types/news-platform";
import { StatTile } from "@/components/stat-tile";

export function FinalIntelligencePanel({ scores }: { scores: FinalIntelligenceSummary }) {
  return (
    <section className="rounded-xl border border-accent/30 bg-card p-6">
      <h2 className="font-serif text-xl font-semibold">Final intelligence synthesis</h2>
      <p className="mt-1 text-xs text-muted-foreground">{scores.disclaimer}</p>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{scores.intelligenceSummary}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Article reliability" value={`${scores.finalArticleReliability}%`} />
        <StatTile
          label="Source reliability"
          value={scores.finalSourceReliability != null ? `${scores.finalSourceReliability}%` : "n/a"}
        />
        <StatTile
          label="Author reliability"
          value={scores.finalAuthorReliability != null ? `${scores.finalAuthorReliability}%` : "n/a"}
        />
        <StatTile
          label="Story confidence"
          value={scores.finalStoryConfidence != null ? `${scores.finalStoryConfidence}%` : "n/a"}
        />
        <StatTile label="Uncertainty level" value={`${scores.finalUncertaintyLevel}%`} />
      </div>
    </section>
  );
}
