import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ReportView } from "@/features/reports/report-view";
import { loadFeedArticleAnalysis } from "@/server/consensus/functions";
import { postJson } from "@/lib/api-client";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { OSCAR, pageTitle } from "@/lib/brand";
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
        articleId: params.articleId,
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
  articlePageScores?: unknown;
  storyReport?: unknown;
  storyScores?: unknown;
};

function FeedArticleAnalysisRoute() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedAnalysis | null>(null);
  const triggered = useRef(false);

  const isPending = "pendingAnalysis" in data && data.pendingAnalysis;

  useEffect(() => {
    if (!isPending || triggered.current) return;
    triggered.current = true;

    void postJson<{
      status: "completed" | "processing";
      report?: ReturnType<typeof analysisReportToManualReport>;
      platformReport?: AnalysisReport;
      explainability?: unknown;
      articlePageScores?: unknown;
      storyReport?: unknown;
    }>("/api/analyze/article", {
      articleId: "articleId" in data ? data.articleId : "",
      clusterId: data.clusterId,
      sync: true,
    }).then((res) => {
      if (!res.success) {
        setAnalysisError(res.details ? `${res.error} (${res.details})` : res.error);
        return;
      }
      if (res.status === "completed" && res.report) {
        setCompleted({
          clusterId: data.clusterId,
          report: res.report,
          platformReport: res.platformReport,
          explainability: res.explainability,
          articlePageScores: res.articlePageScores,
          storyReport: res.storyReport,
        });
      }
    });
  }, [isPending, data]);

  useEffect(() => {
    if (!isPending || completed || analysisError) return;
    const timer = setInterval(() => void router.invalidate(), 2500);
    return () => clearInterval(timer);
  }, [isPending, completed, analysisError, router]);

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
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <h1 className="mt-4 font-serif text-2xl font-semibold">
          {"title" in data ? data.title : "Article"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {analysisError ??
            ("message" in data ? data.message : "Running live Oscar analysis for this article…")}
        </p>
        {!analysisError && (
          <p className="mt-4 text-xs text-muted-foreground">
            This may take 1–3 minutes for full multi-model verification.
          </p>
        )}
        <Link
          to="/consensus/$clusterId"
          params={{ clusterId: data.clusterId }}
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
        articlePageScores={"articlePageScores" in data ? data.articlePageScores : undefined}
        hideTopBackLink
        articlePageMode
        storyScores={"storyScores" in data ? data.storyScores : null}
        storyReport={"storyReport" in data ? data.storyReport : null}
      />
    </>
  );
}
