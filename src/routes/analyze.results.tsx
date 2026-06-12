import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { getJson } from "@/lib/api-client";
import { ReportView } from "@/features/reports/report-view";
import { OSCAR, pageTitle } from "@/lib/brand";
import type { AnalysisReport, FinalIntelligenceSummary } from "@/types/news-platform";
import type { ManualReport } from "@/lib/mock-data";

const searchSchema = z.object({
  id: z.string().min(1),
});

const POLL_MS = 2000;
const NOT_FOUND_MS = 15_000;
const STALE_MS = 3 * 60 * 1000;

type ClientSnapshot = {
  report: AnalysisReport;
  reliability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
};

type PollPayload = {
  requestId: string;
  status: "completed" | "failed" | "processing";
  report?: ManualReport;
  platformReport?: AnalysisReport;
  explainability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
  errorMessage?: string;
  progress?: number;
  startedAt?: string;
};

type ResultsState =
  | { phase: "loading"; message: string }
  | { phase: "completed"; report: ManualReport; platformReport?: AnalysisReport; explainability?: unknown; finalIntelligence?: FinalIntelligenceSummary }
  | { phase: "failed"; message: string; detail?: string };

function readSessionSnapshot(requestId: string): ClientSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`oscar-manual-${requestId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ClientSnapshot;
    return parsed.report ? parsed : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/analyze/results")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: pageTitle(OSCAR.analysis) }] }),
  loaderDeps: ({ search }) => ({ requestId: search.id }),
  loader: ({ deps }) => ({ requestId: deps.requestId }),
  component: AnalyzeResultsPage,
});

function AnalyzeResultsPage() {
  const { requestId } = Route.useLoaderData();
  const [state, setState] = useState<ResultsState>(() => {
    const snap = readSessionSnapshot(requestId);
    if (snap) {
      return {
        phase: "completed",
        report: analysisReportToManualReport(snap.report),
        platformReport: snap.report,
        finalIntelligence: snap.finalIntelligence,
      };
    }
    return { phase: "loading", message: "Running analysis" };
  });
  const pollStartedAt = useRef(Date.now());
  const completedRef = useRef(state.phase === "completed");

  useEffect(() => {
    if (completedRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const finish = (next: ResultsState) => {
      if (cancelled || completedRef.current) return;
      completedRef.current = next.phase === "completed";
      setState(next);
      if (timer) clearInterval(timer);
    };

    const poll = async () => {
      const elapsed = Date.now() - pollStartedAt.current;

      const snap = readSessionSnapshot(requestId);
      if (snap) {
        finish({
          phase: "completed",
          report: analysisReportToManualReport(snap.report),
          platformReport: snap.report,
          finalIntelligence: snap.finalIntelligence,
        });
        return;
      }

      const res = await getJson<PollPayload>(`/api/analyze/status/${encodeURIComponent(requestId)}`);

      if (cancelled) return;

      if (!res.success) {
        const isNotFound = res.code === "NOT_FOUND" || res.details?.includes("404");
        if (isNotFound && elapsed >= NOT_FOUND_MS) {
          finish({
            phase: "failed",
            message: "Analysis session was lost between requests.",
            detail:
              "Enable FEED_KV on the oscar Worker (see wrangler.jsonc), redeploy, and run Ask Oscar again. Or submit a new analysis from the form.",
          });
          return;
        }
        if (elapsed >= STALE_MS) {
          finish({
            phase: "failed",
            message: "Analysis timed out.",
            detail: res.details ? `${res.error} (${res.details})` : res.error,
          });
        }
        return;
      }

      if (res.status === "completed" && (res.platformReport || res.report)) {
        const platformReport = res.platformReport;
        const report =
          res.report ??
          (platformReport ? analysisReportToManualReport(platformReport) : null);
        if (!report) return;
        finish({
          phase: "completed",
          report,
          platformReport,
          explainability: res.explainability,
          finalIntelligence: res.finalIntelligence,
        });
        return;
      }

      if (res.status === "failed") {
        finish({
          phase: "failed",
          message: res.errorMessage ?? "Analysis failed",
        });
        return;
      }

      if (elapsed >= STALE_MS) {
        finish({
          phase: "failed",
          message: "Analysis timed out after several minutes.",
          detail:
            "Try a shorter article, check GEMINI_API_KEY quota, or enable FEED_KV for reliable cross-request state.",
        });
        return;
      }

      setState({
        phase: "loading",
        message: `Running analysis${typeof res.progress === "number" ? ` · ${res.progress}%` : ""}`,
      });
    };

    void poll();
    timer = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [requestId]);

  if (state.phase === "completed") {
    return (
      <ReportView
        report={state.report}
        platformReport={state.platformReport}
        explainability={state.explainability}
        finalIntelligence={state.finalIntelligence}
      />
    );
  }

  if (state.phase === "failed") {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">Analysis failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
        {state.detail ? (
          <p className="mt-2 text-xs text-destructive">{state.detail}</p>
        ) : null}
        <Link to="/analyze" className="mt-6 inline-block text-sm text-accent hover:underline">
          Try again
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">{state.message}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Live multi-model verification usually finishes within 1–4 minutes.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        This page checks for results every few seconds and will show an error if nothing arrives.
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">Request: {requestId}</p>
    </main>
  );
}
