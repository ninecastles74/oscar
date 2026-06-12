import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/news-monitor/dashboard-view";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { OSCAR, pageTitle } from "@/lib/brand";
import { getTop100Feed } from "@/server/news/functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.signals) }] }),
  loader: async () => {
    try {
      const feed = await getTop100Feed({ data: {} });
      const clusters = feed.clusters.map((c, i) => storyClusterToUiCluster(c, i));
      return {
        clusters,
        usingLiveFeed: feed.clusters.length > 0,
        meta: feed.meta,
        bootstrap: feed.bootstrap,
      };
    } catch (err) {
      console.error("[dashboard] feed loader failed:", err instanceof Error ? err.message : err);
      return {
        clusters: [],
        usingLiveFeed: false,
        meta: undefined,
        bootstrap: { ran: false, reason: "loader_failed" },
      };
    }
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  const { clusters, usingLiveFeed, meta } = Route.useLoaderData();
  return <DashboardView clusters={clusters} usingLiveFeed={usingLiveFeed} meta={meta} />;
}
