import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Circle, Database, FileText, GitCompare,
  Layers, ListOrdered, Loader2, Pause, Play, Quote, RotateCcw, Rss, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeMetrics, FEEDS, sampleClusters, sampleNormalized, sampleRawArticles, STAGES,
  type PipelineMetrics, type StageId,
} from "@/lib/mock-data";
import { OSCAR } from "@/lib/brand";

const ICONS: Record<StageId, React.ComponentType<{ className?: string }>> = {
  fetch: Rss, normalize: Database, dedupe: Layers, cluster: Layers, rank: ListOrdered,
  extract: Quote, evidence: Search, compare: GitCompare, detect: AlertTriangle, report: FileText,
};

type Status = "idle" | "running" | "done";

export function PipelineView() {
  const metrics = useMemo(computeMetrics, []);
  const [statuses, setStatuses] = useState<Record<StageId, Status>>(() =>
    Object.fromEntries(STAGES.map((s) => [s.id, "idle"])) as Record<StageId, Status>,
  );
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushLog = (line: string) =>
    setLog((l) => [...l.slice(-80), `${new Date().toLocaleTimeString()}  ${line}`]);

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    setActiveIdx(-1);
    setLog([]);
    setStatuses(Object.fromEntries(STAGES.map((s) => [s.id, "idle"])) as Record<StageId, Status>);
  };

  const runFrom = (idx: number) => {
    if (idx >= STAGES.length) {
      setRunning(false);
      setActiveIdx(-1);
      pushLog("✓ Pipeline complete — final reports generated.");
      return;
    }
    const stage = STAGES[idx];
    setActiveIdx(idx);
    setStatuses((s) => ({ ...s, [stage.id]: "running" }));
    pushLog(`→ [${stage.id}] ${stage.title}: processing…`);
    timer.current = setTimeout(() => {
      setStatuses((s) => ({ ...s, [stage.id]: "done" }));
      pushLog(`✓ [${stage.id}] ${stage.output} ready`);
      runFrom(idx + 1);
    }, Math.max(350, stage.durationMs / 2));
  };

  const start = () => {
    if (running) return;
    setRunning(true);
    const startIdx = activeIdx === -1 ? 0 : activeIdx;
    pushLog("▶ Starting pipeline run");
    runFrom(startIdx);
  };

  const pause = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    pushLog("⏸ Paused");
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{OSCAR.pipeline}</div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Ingest → Cluster → {OSCAR.analysis} → Report</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Simulated end-to-end run. Click <span className="font-semibold text-foreground">Run pipeline</span> to step
            through each stage with mock data — same shape the live system will use.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={running ? pause : start}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            {running ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Run pipeline</>}
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Stage 1 · Sources ingested</h2>
          <span className="font-mono text-xs text-muted-foreground">{metrics.fetched.toLocaleString()} articles / 24h</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FEEDS.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-lg border bg-background p-3">
              <span className={cn("h-2 w-2 rounded-full", f.color, statuses.fetch === "running" && "animate-pulse")} />
              <div>
                <div className="text-sm font-semibold">{f.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.kind}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="grid gap-3 md:grid-cols-2">
          {STAGES.map((stage, i) => {
            const Icon = ICONS[stage.id];
            const status = statuses[stage.id];
            return (
              <div
                key={stage.id}
                className={cn(
                  "relative overflow-hidden rounded-xl border bg-card p-5 transition-all",
                  status === "running" && "ring-2 ring-accent",
                  status === "done" && "border-success/40",
                )}
              >
                <div className="absolute left-0 top-0 h-full w-1 bg-secondary">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      status === "done" ? "bg-success" : status === "running" ? "bg-accent" : "bg-transparent",
                    )}
                    style={{ height: status === "done" ? "100%" : status === "running" ? "60%" : "0%" }}
                  />
                </div>
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-lg border",
                      status === "running"
                        ? "border-accent bg-accent/10 text-accent"
                        : status === "done"
                        ? "border-success/40 bg-success/10 text-success"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">STEP {String(i + 1).padStart(2, "0")}</span>
                      <StatusPill status={status} />
                    </div>
                    <h3 className="mt-1 font-serif text-lg font-semibold">{stage.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono">{stage.input}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono">{stage.output}</span>
                    </div>
                    <StageMetric stageId={stage.id} status={status} metrics={metrics} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-serif text-lg font-semibold">Pipeline log</h3>
            <span className="font-mono text-[10px] text-muted-foreground">{log.length} entries</span>
          </div>
          <div className="h-72 overflow-auto bg-[oklch(0.12_0.02_250)] p-4 font-mono text-[11px] leading-relaxed text-emerald-200">
            {log.length === 0 ? (
              <div className="text-muted-foreground">
                Press <span className="text-emerald-200">Run pipeline</span> to begin.
              </div>
            ) : (
              log.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </div>

        <div className="space-y-4">
          <SamplePayload title="Raw article (NewsAPI shape)" data={sampleRawArticles()[0]} />
          <SamplePayload title="Normalized record" data={sampleNormalized()[0]} />
          <SamplePayload title="Cluster manifest" data={sampleClusters()[0]} />
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Contradictions", value: metrics.issues.contradictions, color: "text-destructive" },
          { label: "Missing context", value: metrics.issues.missingContext, color: "text-warning" },
          { label: "Emotional language", value: metrics.issues.emotional, color: "text-accent" },
          { label: "Unsupported claims", value: metrics.issues.unsupported, color: "text-warning" },
        ].map((x) => (
          <div key={x.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className={cn("h-3 w-3", x.color)} /> {x.label}
            </div>
            <div className={cn("mt-1 font-serif text-3xl font-semibold tabular-nums", x.color)}>{x.value}</div>
          </div>
        ))}
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div>
          <h3 className="font-serif text-lg font-semibold">Final reports ready</h3>
          <p className="text-xs text-muted-foreground">{metrics.reports} cluster analyses produced this run.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/stories"
            className="inline-flex items-center gap-1 rounded-md border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            View Top 100 →
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Running
      </span>
    );
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
        <CheckCircle2 className="h-2.5 w-2.5" /> Done
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Circle className="h-2.5 w-2.5" /> Idle
    </span>
  );
}

function StageMetric({
  stageId, status, metrics,
}: {
  stageId: StageId; status: Status; metrics: PipelineMetrics;
}) {
  const labels: Record<StageId, [string, number | string]> = {
    fetch: ["articles fetched", metrics.fetched],
    normalize: ["normalized records", metrics.normalized],
    dedupe: ["unique articles", metrics.unique],
    cluster: ["clusters formed", metrics.clusters],
    rank: ["top clusters", metrics.top],
    extract: ["claims extracted", metrics.claims],
    evidence: ["evidence snippets", metrics.evidence],
    compare: ["comparisons", metrics.comparisons],
    detect: [
      "issues flagged",
      metrics.issues.contradictions +
        metrics.issues.missingContext +
        metrics.issues.emotional +
        metrics.issues.unsupported,
    ],
    report: ["reports", metrics.reports],
  };
  const [label, value] = labels[stageId];
  return (
    <div className="mt-3 flex items-baseline gap-2">
      <span
        className={cn(
          "font-serif text-2xl font-semibold tabular-nums",
          status === "idle" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {status === "idle" ? "—" : typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function SamplePayload({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <pre className="overflow-auto bg-secondary/30 p-4 text-[11px] leading-relaxed text-foreground/85">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
