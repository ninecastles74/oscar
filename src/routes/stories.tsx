import { createFileRoute } from "@tanstack/react-router";
import { Top100View } from "@/features/story-clusters/top-100-view";
import { pageTitle } from "@/lib/brand";
import { getNewsFeedDiagnostics, getTop100Feed } from "@/server/news/functions";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { CLUSTERS } from "@/lib/mock-data";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [{ title: pageTitle("Top 100 stories") }] }),
  loader: async () => {
    try {
      const [feed, diagnostics] = await Promise.all([
        getTop100Feed({ data: {} }),
        getNewsFeedDiagnostics({ data: {} }),
      ]);
      const clusters =
        feed.clusters.length > 0
          ? feed.clusters.map((c, i) => storyClusterToUiCluster(c, i))
          : CLUSTERS;
      return {
        clusters,
        meta: feed.meta,
        usingLiveFeed: feed.clusters.length > 0,
        bootstrap: feed.bootstrap,
        diagnostics,
      };
    } catch (err) {
      console.error("[stories] feed loader failed:", err instanceof Error ? err.message : err);
      return {
        clusters: CLUSTERS,
        meta: undefined,
        usingLiveFeed: false,
        bootstrap: { ran: false, reason: "loader_failed" },
        diagnostics: undefined,
      };
    }
  },
  component: StoriesRoute,
});

function StoriesRoute() {
  const { clusters, meta, usingLiveFeed, bootstrap, diagnostics } = Route.useLoaderData();
  return (
    <Top100View
      clusters={clusters}
      meta={meta}
      usingLiveFeed={usingLiveFeed}
      bootstrap={bootstrap}
      diagnostics={diagnostics}
    />
  );
}
