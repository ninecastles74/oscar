import type { ClaimResearchReport } from "@/types/news-platform";
import { ConfidenceBar } from "@/components/confidence-bar";
import { EvidenceWeightPanel } from "./evidence-weight-panel";
import { SourceChainPanel } from "./source-chain-panel";

export function ClaimResearchPanel({ research }: { research: ClaimResearchReport }) {
  const { scores } = research;

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-accent">
          Claim research
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {research.researchSummary}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ConfidenceBar value={scores.evidenceQualityScore} label="Evidence quality" />
        <ConfidenceBar value={scores.sourceIndependenceScore} label="Source independence" />
        <ConfidenceBar value={scores.corroborationScore} label="Corroboration" />
        <ConfidenceBar value={scores.contradictionScore} label="Contradiction (risk)" />
        <div className="sm:col-span-2">
          <ConfidenceBar value={scores.finalConfidenceScore} label="Final confidence" />
        </div>
      </div>

      {research.primaryEvidence.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground">Primary evidence</p>
          <ul className="mt-2 space-y-2 text-xs">
            {research.primaryEvidence.slice(0, 3).map((e) => (
              <li key={e.id} className="rounded border bg-card p-2">
                <span className="font-medium">{e.sourceName}</span> · {e.tier}
                <p className="mt-1 italic text-muted-foreground">"{e.excerpt.slice(0, 120)}…"</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {research.copiedReporting.length > 0 && (
        <p className="text-xs text-warning">
          Copied reporting: {research.copiedReporting.length} similar excerpt pair(s) detected.
        </p>
      )}

      {research.anonymousSourceDependency.length > 0 && (
        <p className="text-xs text-warning">
          Anonymous-source signals: {research.anonymousSourceDependency.map((a) => a.pattern).join(", ")}
        </p>
      )}

      {research.unsupported.isUnsupported && (
        <p className="text-xs font-medium text-destructive">{research.unsupported.reason}</p>
      )}

      <EvidenceWeightPanel research={research} />
      {research.sourceChainTrace && <SourceChainPanel trace={research.sourceChainTrace} />}
    </div>
  );
}
