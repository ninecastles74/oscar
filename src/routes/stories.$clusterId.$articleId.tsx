import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ReportView } from "@/features/reports/report-view";
import { loadFeedArticleAnalysis } from "@/server/consensus/functions";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/stories/$clusterId/$articleId")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.analysis) }] }),
  loader: async ({ params }) => {
    const result = await loadFeedArticleAnalysis({
      data: { clusterId: params.clusterId, articleId: params.articleId },
    });

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
      explainability: result.explainability,
    };
  },
  component: FeedArticleAnalysisRoute,
  notFoundComponent: () => <div className="p-12 text-center">Article not found</div>,
});

function FeedArticleAnalysisRoute() {
  const data = Route.useLoaderData();

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
      />
    </>
  );
}
