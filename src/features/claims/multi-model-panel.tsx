import type { MultiModelClaimVerification } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { Bot, Scale, Search } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini AI",
};

export function MultiModelPanel({ verification }: { verification: MultiModelClaimVerification }) {
  const { consensus } = verification;
  const geminiVerdict = consensus.modelVerdicts.find((v) => v.provider === "google");

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
        {verification.stagesRun.includes("gemini_corroboration") && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pipeline stages: {verification.stagesRun.join(" → ")}
          </p>
        )}
      </div>

      {geminiVerdict && (
        <GeminiUsageBlock verdict={geminiVerdict} />
      )}

      <ul className="space-y-2">
        {consensus.modelVerdicts.map((v) => (
          <li
            key={`${v.provider}-${v.role}`}
            className="flex flex-wrap items-baseline justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground">
              {PROVIDER_LABELS[v.provider] ?? v.provider} ({v.role})
              {v.skipped && " · skipped"}
              {v.model.startsWith("heuristic") ? " · offline" : ""}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {v.skipped ? "—" : `${v.verdict} ${v.confidence}%`}
            </span>
          </li>
        ))}
      </ul>

      {geminiVerdict?.skipReason && !geminiVerdict.geminiMeta?.liveApiCalled && (
        <p className="text-xs text-amber-800 dark:text-amber-300">{geminiVerdict.skipReason}</p>
      )}

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

function GeminiUsageBlock({
  verdict,
}: {
  verdict: MultiModelClaimVerification["consensus"]["modelVerdicts"][0];
}) {
  const meta = verdict.geminiMeta;

  if (!meta?.liveApiCalled) {
    return (
      <div className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
          <Search className="h-3.5 w-3.5" />
          Gemini AI — no live API usage
        </div>
        <p className="mt-1 text-muted-foreground">
          {verdict.skipReason ??
            "Corroboration used offline heuristics only. Add GOOGLE_AI_API_KEY or GEMINI_API_KEY on the server."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-200">
        <Search className="h-3.5 w-3.5" />
        Gemini AI — live API
        <span className="font-normal text-muted-foreground">({verdict.model})</span>
      </div>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Google Search:</span>{" "}
          {meta.searchPerformed
            ? `${meta.searchQueryCount} quer${meta.searchQueryCount === 1 ? "y" : "ies"} run`
            : "not used for this claim"}
        </li>
        {meta.totalTokens != null && (
          <li>
            <span className="font-medium text-foreground">Tokens:</span>{" "}
            {meta.totalTokens.toLocaleString()}
            {meta.promptTokens != null && meta.completionTokens != null
              ? ` (${meta.promptTokens} in / ${meta.completionTokens} out)`
              : ""}
          </li>
        )}
        {meta.webSearchQueries.length > 0 && (
          <li>
            <span className="font-medium text-foreground">Searches:</span>{" "}
            {meta.webSearchQueries.join(" · ")}
          </li>
        )}
        {meta.sourcesUsed.length > 0 && (
          <li>
            <span className="font-medium text-foreground">Sources:</span>{" "}
            {meta.sourcesUsed
              .map((s) => s.title ?? s.uri ?? "web")
              .slice(0, 3)
              .join("; ")}
            {meta.sourcesUsed.length > 3 ? ` (+${meta.sourcesUsed.length - 3} more)` : ""}
          </li>
        )}
      </ul>
    </div>
  );
}
