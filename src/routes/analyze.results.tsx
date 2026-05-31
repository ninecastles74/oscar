import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { ReportView } from "@/features/reports/report-view";
import { getAiDiagnostics, getManualAnalysis } from "@/server/analysis/functions";
import { OSCAR, pageTitle } from "@/lib/brand";
import type { AnalysisReport, FinalIntelligenceSummary } from "@/types/news-platform";
import type { ManualSubmission } from "@/types/news-platform";

const searchSchema = z.object({
  id: z.string().min(1),
});

const STALE_MS = 90 * 1000;
const NOT_FOUND_GRACE_MS = 15 * 1000;

type ClientSnapshot = {
  report: AnalysisReport;
  reliability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
  submission?: ManualSubmission;
};

export const Route = createFileRoute("/analyze/results")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: pageTitle(OSCAR.analysis) }] }),
  loaderDeps: ({ search }) => ({ requestId: search.id }),
  loader: async ({ deps }) => {
    let aiDiagnostics: Awaited<ReturnType<typeof getAiDiagnostics>> | undefined;
    try {
      aiDiagnostics = await getAiDiagnostics({ data: undefined });
    } catch {
      aiDiagnostics = undefined;
    }
    const result = await getManualAnalysis({ data: { requestId: deps.requestId } });

    if ("error" in result && result.error && typeof result.error === "object") {
      if ("code" in result.error && result.error.code === "NOT_FOUND") {
        return {
          pending: true,
          requestId: deps.requestId,
          status: "processing" as const,
          notFound: true as const,
        };
      }
      return { error: result.error, requestId: deps.requestId };
    }

    if ("status" in result && result.status === "failed") {
      return {
        failed: true,
        requestId: deps.requestId,
        errorMessage:
          "errorMessage" in result && typeof result.errorMessage === "string"
            ? result.errorMessage
            : "Analysis failed",
        aiDiagnostics,
      };
    }

    if (!result.report) {
      return {
        pending: true,
        requestId: deps.requestId,
        status: result.status ?? "processing",
        progress: "progress" in result ? result.progress : undefined,
        startedAt: "startedAt" in result ? result.startedAt : undefined,
        aiDiagnostics,
      };
    }

    return {
      report: analysisReportToManualReport(result.report),
      platformReport: result.report,
      explainability: "explainability" in result ? result.explainability : undefined,
      finalIntelligence:
        "finalIntelligence" in result ? result.finalIntelligence : undefined,
      requestId: deps.requestId,
      submission: result.submission,
      aiDiagnostics,
    };
  },
  component: AnalyzeResultsPage,
});

function AnalyzeResultsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const requestId = "requestId" in data ? data.requestId : "";
  const [clientSnapshot, setClientSnapshot] = useState<ClientSnapshot | null>(null);
  const [pollStartedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!requestId || typeof window === "undefined") return;
    const raw = sessionStorage.getItem(`oscar-manual-${requestId}`);
    if (!raw) return;
    try {
      setClientSnapshot(JSON.parse(raw) as ClientSnapshot);
    } catch {
      /* ignore */
    }
  }, [requestId]);

  const isPending = "pending" in data && data.pending;
  const isFailed = ("failed" in data && data.failed) || false;
  const notFoundLost =
    isPending &&
    "notFound" in data &&
    data.notFound &&
    !clientSnapshot &&
    Date.now() - pollStartedAt > NOT_FOUND_GRACE_MS;
  const stale =
    isPending &&
    !notFoundLost &&
    "startedAt" in data &&
    typeof data.startedAt === "string" &&
    Date.now() - new Date(data.startedAt).getTime() > STALE_MS;
  const staleWithoutStartedAt =
    isPending &&
    !notFoundLost &&
    !("startedAt" in data && typeof data.startedAt === "string") &&
    Date.now() - pollStartedAt > STALE_MS;

  useEffect(() => {
    if (!isPending || isFailed || stale || staleWithoutStartedAt || notFoundLost || clientSnapshot) return;
    const timer = setInterval(() => {
      void router.invalidate();
    }, 2000);
    return () => clearInterval(timer);
  }, [isPending, isFailed, stale, staleWithoutStartedAt, notFoundLost, clientSnapshot, router]);

  if (clientSnapshot?.report) {
    const aiDiag = "aiDiagnostics" in data ? data.aiDiagnostics : undefined;
    return (
      <>
        {aiDiag && typeof aiDiag === "object" && !("error" in aiDiag) && (
          <div className="mx-auto max-w-6xl px-6 pt-4">
            <p className="text-xs text-muted-foreground">Loaded from this browser session.</p>
          </div>
        )}
        <ReportView
          report={analysisReportToManualReport(clientSnapshot.report)}
          platformReport={clientSnapshot.report}
          finalIntelligence={clientSnapshot.finalIntelligence}
        />
      </>
    );
  }

  if ("error" in data && data.error && !isPending) {
    const errCode = "code" in data.error ? String(data.error.code) : "";
    const isLiveRequired = errCode === "LIVE_AI_REQUIRED";
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">{isLiveRequired ? "Live AI required" : "Analysis failed"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link to="/analyze" className="mt-6 inline-block text-sm text-accent hover:underline">
          Try again
        </Link>
      </main>
    );
  }

  if (isFailed || stale || staleWithoutStartedAt || notFoundLost) {
    const msg =
      notFoundLost
        ? "Analysis session was lost between requests. Enable FEED_KV on the oscar Worker (see wrangler.jsonc), redeploy, and run Ask Oscar again."
        : isFailed && "errorMessage" in data && typeof data.errorMessage === "string"
          ? data.errorMessage
          : stale || staleWithoutStartedAt
            ? "Analysis timed out. Enable FEED_KV on the oscar Worker for reliable background jobs, or retry with a shorter article."
            : "Analysis could not be completed.";
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">Analysis failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
        <Link to="/analyze" className="mt-6 inline-block text-sm text-accent hover:underline">
          Try again
        </Link>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Running analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {data.status ?? "processing"}
          {typeof data.progress === "number" ? ` · ${data.progress}%` : ""}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          This page refreshes automatically. Live AI usually finishes within 1–3 minutes.
        </p>
      </main>
    );
  }

  const aiDiag = "aiDiagnostics" in data ? data.aiDiagnostics : undefined;

  if (!("report" in data) || !data.report) {
    return null;
  }

  return (
    <>
      {aiDiag && typeof aiDiag === "object" && !("error" in aiDiag) && (
        <div className="mx-auto max-w-6xl border-b bg-secondary/20 px-6 py-3 text-xs">
          <p className="font-semibold">Server AI diagnostics (live)</p>
          <p className="text-muted-foreground">
            Google key detected: {aiDiag.googleKeyDetected ? "yes" : "no"}
            {" · "}Configured: {(aiDiag.detectedAiEnvKeys ?? []).join(", ") || "none"}
          </p>
          {aiDiag.likelyOfflineReason && (
            <p className="mt-1 text-muted-foreground">{aiDiag.likelyOfflineReason}</p>
          )}
        </div>
      )}
      <ReportView
        report={data.report}
        platformReport={data.platformReport}
        explainability={data.explainability}
        finalIntelligence={data.finalIntelligence}
      />
    </>
  );
}
