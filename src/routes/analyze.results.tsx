import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { ReportView } from "@/features/reports/report-view";
import { getAiDiagnostics, getManualAnalysis } from "@/server/analysis/functions";
import { OSCAR, pageTitle } from "@/lib/brand";

const searchSchema = z.object({
  id: z.string().min(1),
});

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
        return { pending: true, requestId: deps.requestId, status: "processing" as const };
      }
      return { error: result.error, requestId: deps.requestId };
    }

    if (!result.report) {
      return {
        pending: true,
        requestId: deps.requestId,
        status: result.status ?? "processing",
        progress: "progress" in result ? result.progress : undefined,
        errorMessage: "error" in result ? result.error : undefined,
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

  const isPending = "pending" in data && data.pending;
  const isFailed =
    isPending &&
    (data.status === "failed" ||
      (typeof data.errorMessage === "string" && data.errorMessage.length > 0));

  useEffect(() => {
    if (!isPending || isFailed) return;
    const timer = setInterval(() => {
      void router.invalidate();
    }, 2000);
    return () => clearInterval(timer);
  }, [isPending, isFailed, router]);

  if ("error" in data && data.error && !isPending) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Analysis failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link
          to="/analyze"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Try again
        </Link>
      </main>
    );
  }

  if (isPending) {
    if (isFailed) {
      const msg =
        typeof data.errorMessage === "string"
          ? data.errorMessage
          : "Analysis could not be completed.";
      return (
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="font-serif text-2xl font-semibold">Analysis failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
          <Link
            to="/analyze"
            className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
          >
            Try again
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <h1 className="mt-4 font-serif text-2xl font-semibold">Running analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: {data.status ?? "processing"}
          {typeof data.progress === "number" ? ` · ${data.progress}%` : ""}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          This page refreshes automatically. URL articles use metadata and excerpts; paste full text
          for deeper checks.
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
        <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Server AI diagnostics (live)</p>
          <p className="text-muted-foreground">
            Google key detected: {aiDiag.googleKeyDetected ? "yes" : "no"} · Keys:{" "}
            {(aiDiag.detectedAiEnvKeys ?? []).join(", ") || "none"}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{aiDiag.likelyOfflineReason}</p>
        </div>
      )}
      <ReportView
        report={data.report}
        platformReport={"platformReport" in data ? data.platformReport : undefined}
        explainability={"explainability" in data ? data.explainability : undefined}
        finalIntelligence={"finalIntelligence" in data ? data.finalIntelligence : undefined}
      />
    </>
  );
}
