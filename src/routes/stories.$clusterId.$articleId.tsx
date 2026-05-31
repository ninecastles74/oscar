import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ReportView } from "@/features/reports/report-view";
import { loadFeedArticleAnalysis } from "@/server/consensus/functions";
import { OSCAR, pageTitle } from "@/lib/brand";

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

function FeedArticleAnalysisRoute() {
  const data = Route.useLoaderData();
  const router = useRouter();

  useEffect(() => {
    if (!("pendingAnalysis" in data) || !data.pendingAnalysis) return;
    const timer = setInterval(() => void router.invalidate(), 2500);
    return () => clearInterval(timer);
  }, [data, router]);

  if ("pendingAnalysis" in data && data.pendingAnalysis) {
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <h1 className="mt-4 font-serif text-2xl font-semibold">{data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.message ?? "Running live Oscar analysis for this article…"}
        </p>
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
        articlePageScores={"articlePageScores" in data ? data.articlePageScores : null}
        hideTopBackLink
        articlePageMode
        storyScores={"storyScores" in data ? data.storyScores : null}
        storyReport={"storyReport" in data ? data.storyReport : null}
      />
    </>
  );
}
