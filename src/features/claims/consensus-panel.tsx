import type { ClaimConsensusReport } from "@/types/news-platform";
import { CLAIM_CONSENSUS_DISCLAIMERS } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { Layers } from "lucide-react";

export function ConsensusPanel({ consensus }: { consensus: ClaimConsensusReport }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          <Layers className="h-3.5 w-3.5" />
          {OSCAR.consensus}
        </h4>
        <p className="mt-1 text-sm font-semibold capitalize text-foreground">
          {consensus.verdict.replace(/_/g, " ")} · {consensus.confidence}% confidence
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{consensus.reasoning}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          Composite score: {consensus.compositeScore}/100
        </p>
      </div>

      <ul className="space-y-1.5">
        {consensus.signals.map((s) => (
          <li key={s.dimension} className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-foreground">
              {s.score} <span className="font-normal text-muted-foreground">×{Math.round(s.weight * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[10px] leading-snug text-muted-foreground/80">
        {CLAIM_CONSENSUS_DISCLAIMERS[1]}
      </p>
    </div>
  );
}
