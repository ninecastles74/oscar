import type { SourceChainTraceReport } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { AlertTriangle, GitBranch, Radio } from "lucide-react";

export function SourceChainPanel({ trace }: { trace: SourceChainTraceReport }) {
  const { reportingDependencyMap: map } = trace;
  const topOrigin = trace.originalSourceLikelihood[0];

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-secondary/20 p-4">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          {OSCAR.sourceChain}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{trace.traceSummary}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="Independent sources" value={String(trace.independentSourceCount)} />
        <Stat label="Syndicated / repeat" value={String(trace.syndicatedSourceCount)} />
        <Stat
          label="Top origin likelihood"
          value={topOrigin ? `${topOrigin.likelihood}%` : "—"}
        />
      </div>

      {topOrigin && (
        <div className="rounded border bg-card p-3 text-xs">
          <p className="font-medium text-foreground">
            Likely origin: {topOrigin.sourceName}
            <span className="ml-2 text-muted-foreground">({topOrigin.role})</span>
          </p>
          <p className="mt-1 text-muted-foreground">{topOrigin.rationale}</p>
        </div>
      )}

      {trace.originalSourceLikelihood.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-foreground">Origin likelihood ranking</p>
          <ul className="mt-2 space-y-1.5">
            {trace.originalSourceLikelihood.slice(0, 5).map((o) => (
              <li key={o.sourceId} className="flex items-center justify-between text-xs">
                <span>{o.sourceName}</span>
                <span className="tabular-nums text-muted-foreground">{o.likelihood}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {map.edges.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground">Reporting dependency map</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {map.edges.slice(0, 6).map((e, i) => (
              <li key={`${e.fromSourceId}-${e.toSourceId}-${i}`}>
                {nodeName(map, e.fromSourceId)} → {nodeName(map, e.toSourceId)}
                <span className="ml-1 text-foreground/60">({e.relationship})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trace.wirePropagation.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Wire propagation</p>
            {trace.wirePropagation.map((w) => (
              <p key={w.wireSourceId}>
                {w.wireSourceName} → {w.downstreamSourceIds.length} downstream outlet(s)
              </p>
            ))}
          </div>
        </div>
      )}

      {trace.citationChains.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground">Citation chains</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {trace.citationChains.map((c) => (
              <li key={c.chainId}>{c.orderedSourceNames.join(" → ")}</li>
            ))}
          </ul>
        </div>
      )}

      {trace.repeatedOriginalSourceGroups.length > 0 && (
        <p className="text-xs text-warning">
          {trace.repeatedOriginalSourceGroups.length} outlet group(s) repeat the same original
          source.
        </p>
      )}

      {trace.circularReporting.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Circular reporting</p>
            {trace.circularReporting.map((c, i) => (
              <p key={i} className="text-muted-foreground">
                {c.description}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function nodeName(
  map: SourceChainTraceReport["reportingDependencyMap"],
  sourceId: string,
): string {
  return map.nodes.find((n) => n.sourceId === sourceId)?.sourceName ?? sourceId;
}
