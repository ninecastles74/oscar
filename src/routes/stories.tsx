import { createFileRoute } from "@tanstack/react-router";
import { Top100View } from "@/features/story-clusters/top-100-view";
import { pageTitle } from "@/lib/brand";
import { getTop100Feed } from "@/server/news/functions";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { CLUSTERS } from "@/lib/mock-data";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [{ title: pageTitle("Top 100 stories") }] }),
  loader: async () => {
    const feed = await getTop100Feed({ data: {} });
    const clusters =
      feed.clusters.length > 0
        ? feed.clusters.map((c, i) => storyClusterToUiCluster(c, i))
        : CLUSTERS;
    return { clusters, meta: feed.meta, usingLiveFeed: feed.clusters.length > 0 };
  },
  component: StoriesRoute,
});

function StoriesRoute() {
  const { clusters, meta, usingLiveFeed } = Route.useLoaderData();
  return <Top100View clusters={clusters} meta={meta} usingLiveFeed={usingLiveFeed} />;
}
