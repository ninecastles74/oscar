import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { getJson } from "@/lib/api-client";
import { ReportView } from "@/features/reports/report-view";
import { OSCAR, pageTitle } from "@/lib/brand";
import type { FinalAnalysisReport } from "@/lib/final-analysis-report";
import { userFacingAnalysisError } from "@/lib/user-facing-errors";
import type { AnalysisReport, FinalIntelligenceSummary } from "@/types/news-platform";
import type { ManualReport } from "@/lib/mock-data";

const searchSchema = z.object({
  id: z.string().min(1),
});

const POLL_MS = 2000;
const NOT_FOUND_MS = 10_000;
const STALE_MS = 90_000;
const MAX_POLL_FAILURES = 3;

type ClientSnapshot = {
  report: AnalysisReport;
  reliability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
  finalAnalysis?: FinalAnalysisReport;
};

type PollPayload = {
  requestId: string;
  status: "completed" | "failed" | "processing";
  report?: ManualReport;
  platformReport?: AnalysisReport;
  explainability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
  finalAnalysis?: FinalAnalysisReport;
  errorMessage?: string;
  progress?: number;
  startedAt?: string;
};

type ResultsState =
  | { phase: "loading"; message: string }
  | {
      phase: "completed";
      report: ManualReport;
      platformReport?: AnalysisReport;
      explainability?: unknown;
      finalIntelligence?: FinalIntelligenceSummary;
      finalAnalysis?: FinalAnalysisReport;
    }
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
        finalAnalysis: snap.finalAnalysis,
      };
    }
    return { phase: "loading", message: "Running analysis" };
  });
  const pollStartedAt = useRef(Date.now());
  const completedRef = useRef(state.phase === "completed");
  const pollFailuresRef = useRef(0);

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
          finalAnalysis: snap.finalAnalysis,
        });
        return;
      }

      const res = await getJson<PollPayload>(`/api/analyze/status/${encodeURIComponent(requestId)}`);

      if (cancelled) return;

      if (!res.success) {
        pollFailuresRef.current += 1;
        const isNotFound =
          res.code === "NOT_FOUND" ||
          res.details?.includes("404") ||
          res.details?.includes("HTTP 404");
        if (
          isNotFound &&
          (elapsed >= NOT_FOUND_MS || pollFailuresRef.current >= MAX_POLL_FAILURES)
        ) {
          finish({
            phase: "failed",
            message: "Could not reach the analysis status API.",
            detail:
              "The /api/analyze/status route may be missing from the deployed build. Redeploy the latest code, enable FEED_KV, or run a new analysis from /analyze.",
          });
          return;
        }
        if (pollFailuresRef.current >= MAX_POLL_FAILURES || elapsed >= STALE_MS) {
          finish({
            phase: "failed",
            message: userFacingAnalysisError(res.error, res.details, res.code),
          });
        }
        return;
      }

      pollFailuresRef.current = 0;

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
          finalAnalysis: res.finalAnalysis,
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
        finalAnalysis={state.finalAnalysis}
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
