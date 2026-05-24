import type { MultiModelClaimVerification } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { Bot, Scale } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
};

export function MultiModelPanel({ verification }: { verification: MultiModelClaimVerification }) {
  const { consensus } = verification;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
          <Bot className="h-3.5 w-3.5" />
          {OSCAR.multiModel}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">{consensus.consensusSummary}</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {OSCAR.consensus}: {consensus.finalVerdict} · {consensus.finalConfidence}%
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({consensus.arbitrationMethod.replace(/_/g, " ")})
          </span>
        </p>
      </div>

      <ul className="space-y-2">
        {consensus.modelVerdicts.map((v) => (
          <li
            key={`${v.provider}-${v.role}`}
            className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground">
              {PROVIDER_LABELS[v.provider] ?? v.provider} ({v.role})
              {v.skipped && " · skipped"}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {v.skipped ? "—" : `${v.verdict} ${v.confidence}%`}
            </span>
          </li>
        ))}
      </ul>

      {consensus.disagreementDetected && consensus.disagreements.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2 text-xs">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">Model disagreement</p>
            {consensus.disagreements.map((d, i) => (
              <p key={i} className="text-muted-foreground">
                {d.description}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
