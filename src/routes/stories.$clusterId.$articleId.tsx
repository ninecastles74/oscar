import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ReportView } from "@/features/reports/report-view";
import { loadFeedArticleAnalysis } from "@/server/consensus/functions";
import { postJson } from "@/lib/api-client";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { OSCAR, pageTitle } from "@/lib/brand";
import { userFacingAnalysisError } from "@/lib/user-facing-errors";
import type { AnalysisReport } from "@/types/news-platform";

export const Route = createFileRoute("/stories/$clusterId/$articleId")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.analysis) }] }),
  loader: async ({ params }) => {
    const result = await loadFeedArticleAnalysis({
      data: { clusterId: params.clusterId, articleId: params.articleId },
    });

    if (result && "pendingAnalysis" in result && result.pendingAnalysis) {
      return {
        pendingAnalysis: true as const,
        clusterId: params.clusterId,
        articleId: result.articleId ?? params.articleId,
        title: result.title ?? "Article",
        message: result.message,
      };
    }

    if (result && "error" in result && result.error) {
      if (result.error.code === "NOT_FOUND") throw notFound();
      return { error: result.error, clusterId: params.clusterId };
    }

    if (!result || !("report" in result) || !result.report) {
      throw notFound();
    }

    return {
      clusterId: params.clusterId,
      report: result.report,
      platformReport: result.platformReport,
      explainability: "explainability" in result ? result.explainability : undefined,
      finalAnalysis: "finalAnalysis" in result ? result.finalAnalysis : undefined,
      articlePageScores:
        "articlePageScores" in result ? result.articlePageScores : undefined,
      storyReport: "storyReport" in result ? result.storyReport : null,
      storyScores: "storyScores" in result ? result.storyScores : null,
    };
  },
  component: FeedArticleAnalysisRoute,
  notFoundComponent: () => <div className="p-12 text-center">Article not found</div>,
});

type CompletedAnalysis = {
  clusterId: string;
  report: ReturnType<typeof analysisReportToManualReport>;
  platformReport?: AnalysisReport;
  explainability?: unknown;
  finalAnalysis?: import("@/lib/final-analysis-report").FinalAnalysisReport;
  articlePageScores?: unknown;
  storyReport?: unknown;
  storyScores?: unknown;
};

type AnalyzeArticleResponse = {
  status: "completed" | "processing" | "failed";
  report?: ReturnType<typeof analysisReportToManualReport>;
  platformReport?: AnalysisReport;
  explainability?: unknown;
  finalAnalysis?: import("@/lib/final-analysis-report").FinalAnalysisReport;
  articlePageScores?: unknown;
  storyReport?: unknown;
};

const ARTICLE_STALE_MS = 3 * 60 * 1000;

function FeedArticleAnalysisRoute() {
  const data = Route.useLoaderData();
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedAnalysis | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const triggered = useRef(false);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const isPending = "pendingAnalysis" in data && data.pendingAnalysis;
  const clusterId = data.clusterId;
  const articleId = "articleId" in data ? data.articleId : "";
  const timedOut = isPending && !completed && !analysisError && now - startedAt > ARTICLE_STALE_MS;

  const runAnalysis = useCallback(async () => {
    if (!articleId) return;
    setAnalysisRunning(true);
    setAnalysisError(null);

    try {
      const res = await postJson<AnalyzeArticleResponse>("/api/analyze/article", {
        articleId,
        clusterId,
        sync: true,
      });

      if (!res.success) {
        setAnalysisError(userFacingAnalysisError(res.error, res.details, res.code));
        return;
      }

      if (res.status === "completed") {
        const platformReport = res.platformReport;
        const report =
          res.report ?? (platformReport ? analysisReportToManualReport(platformReport) : null);
        if (!report) {
          setAnalysisError("Analysis completed but no report was returned.");
          return;
        }
        setCompleted({
          clusterId,
          report,
          platformReport,
          explainability: res.explainability,
          finalAnalysis: res.finalAnalysis,
          articlePageScores: res.articlePageScores,
          storyReport: res.storyReport,
        });
        return;
      }

      if (res.status === "processing") {
        setAnalysisError(
          "Analysis started in the background but no report was returned. Redeploy with FEED_KV enabled or retry.",
        );
        return;
      }

      setAnalysisError(
        `Unexpected analysis response (status: ${String((res as { status?: string }).status ?? "unknown")}). Try again.`,
      );
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalysisRunning(false);
    }
  }, [articleId, clusterId]);

  useEffect(() => {
    if (!isPending || triggered.current) return;
    triggered.current = true;
    void runAnalysis();
  }, [isPending, runAnalysis]);

  if (completed) {
    return (
      <>
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <Link
            to="/consensus/$clusterId"
            params={{ clusterId: completed.clusterId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to cluster analysis
          </Link>
        </div>
        <ReportView
          report={completed.report}
          platformReport={completed.platformReport}
          explainability={completed.explainability}
          finalAnalysis={completed.finalAnalysis}
          articlePageScores={completed.articlePageScores}
          hideTopBackLink
          articlePageMode
          storyScores={completed.storyScores}
          storyReport={completed.storyReport}
        />
      </>
    );
  }

  if (isPending) {
    const displayError =
      analysisError ??
      (timedOut
        ? "Analysis timed out after several minutes. Check GEMINI_API_KEY quota and FEED_KV, then retry."
        : null);

    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        {!displayError && <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />}
        <h1 className="mt-4 font-serif text-2xl font-semibold">
          {"title" in data ? data.title : "Article"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {displayError ??
            ("message" in data ? data.message : "Running live Oscar analysis for this article…")}
        </p>
        {!displayError && (
          <p className="mt-4 text-xs text-muted-foreground">
            {analysisRunning
              ? "Analysis in progress — this may take 1–4 minutes."
              : "Starting Oscar analysis…"}
          </p>
        )}
        {displayError && (
          <button
            type="button"
            onClick={() => {
              triggered.current = false;
              void runAnalysis();
            }}
            className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Retry analysis
          </button>
        )}
        <Link
          to="/consensus/$clusterId"
          params={{ clusterId }}
          className="mt-6 text-sm text-accent hover:underline"
        >
          Back to cluster analysis
        </Link>
      </main>
    );
  }

  if ("error" in data && data.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Analysis unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link
          to="/consensus/$clusterId"
          params={{ clusterId: data.clusterId }}
          className="mt-6 inline-block text-sm text-accent hover:underline"
        >
          View cluster analysis
        </Link>
      </main>
    );
  }

  if (!("report" in data)) return null;

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <Link
          to="/consensus/$clusterId"
          params={{ clusterId: data.clusterId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to cluster analysis
        </Link>
      </div>
      <ReportView
        report={data.report}
        platformReport={data.platformReport}
        explainability={data.explainability}
        finalAnalysis={"finalAnalysis" in data ? data.finalAnalysis : undefined}
        articlePageScores={"articlePageScores" in data ? data.articlePageScores : undefined}
        hideTopBackLink
        articlePageMode
        storyScores={"storyScores" in data ? data.storyScores : null}
        storyReport={"storyReport" in data ? data.storyReport : null}
      />
    </>
  );
}
