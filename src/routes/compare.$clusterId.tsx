import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { CompareMatrixView } from "@/features/story-clusters/compare-matrix-view";
import { loadFeedClusterConsensus } from "@/server/consensus/functions";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/compare/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`Source comparison · ${params.clusterId}`) }] }),
  loader: async ({ params }) => {
    const live = await loadFeedClusterConsensus({ data: { clusterId: params.clusterId } });
    if (live && "report" in live && live.report) {
      return {
        cluster: storyClusterToUiCluster(live.cluster, 0),
        report: live.report,
        usingLiveFeed: true,
      };
    }
    if (live && "error" in live && live.error && live.cluster) {
      return {
        error: live.error,
        cluster: storyClusterToUiCluster(live.cluster, 0),
        usingLiveFeed: true,
      };
    }

    throw notFound();
  },
  component: CompareRoute,
  notFoundComponent: () => <div className="p-12 text-center">Cluster not found</div>,
});

function CompareRoute() {
  const data = Route.useLoaderData();
  if ("error" in data && data.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Comparison unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link to="/stories" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to Top 100
        </Link>
      </main>
    );
  }

  return (
    <CompareMatrixView
      cluster={data.cluster}
      consensusReport={"report" in data ? data.report : undefined}
      usingLiveFeed={data.usingLiveFeed}
    />
  );
}
