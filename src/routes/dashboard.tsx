import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/news-monitor/dashboard-view";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { OSCAR, pageTitle } from "@/lib/brand";
import { getTop100Feed } from "@/server/news/functions";
import { CLUSTERS } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.signals) }] }),
  loader: async () => {
    try {
      const feed = await getTop100Feed({ data: {} });
      const clusters =
        feed.clusters.length > 0
          ? feed.clusters.map((c, i) => storyClusterToUiCluster(c, i))
          : CLUSTERS;
      return {
        clusters,
        usingLiveFeed: feed.clusters.length > 0,
        meta: feed.meta,
      };
    } catch (err) {
      console.error("[dashboard] feed loader failed:", err instanceof Error ? err.message : err);
      return { clusters: CLUSTERS, usingLiveFeed: false, meta: undefined };
    }
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const { clusters, usingLiveFeed, meta } = Route.useLoaderData();
  return <DashboardView clusters={clusters} usingLiveFeed={usingLiveFeed} meta={meta} />;
}
