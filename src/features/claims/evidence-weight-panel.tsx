import { EVIDENCE_TYPE_LABELS } from "@/lib/evidence-weight-labels";
import { OSCAR } from "@/lib/brand";
import type { ClaimResearchReport, ResearchEvidence } from "@/types/news-platform";

export function EvidenceWeightPanel({ research }: { research: ClaimResearchReport }) {
  const quality = research.evidenceQuality;
  if (!quality) return null;

  const topWeighted = [...research.allEvidence]
    .sort((a, b) => (b.dynamicWeight ?? 0) - (a.dynamicWeight ?? 0))
    .slice(0, 4);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-card/50 p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">{OSCAR.evidence}</p>
        <p className="mt-1 text-xs text-muted-foreground">{quality.summary}</p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
          Aggregate quality: {quality.aggregateScore}/100
        </p>
      </div>

      {topWeighted.length > 0 && (
        <ul className="space-y-2">
          {topWeighted.map((e) => (
            <WeightRow key={e.id} item={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WeightRow({ item }: { item: ResearchEvidence }) {
  const label = EVIDENCE_TYPE_LABELS[item.evidenceType] ?? item.evidenceType;
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="truncate text-muted-foreground">
        {item.sourceName ?? item.sourceId} · {label}
      </span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">
        {item.dynamicWeight}
      </span>
    </li>
  );
}
