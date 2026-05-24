import { createFileRoute, notFound } from "@tanstack/react-router";
import { ClusterView } from "@/features/story-clusters/cluster-view";
import { pageTitle } from "@/lib/brand";
import { articleToUiStory, storyClusterToUiCluster } from "@/lib/feed-adapter";
import { clusterById, storiesForCluster } from "@/lib/mock-data";
import { getFeedClusterDetail } from "@/server/news/functions";

export const Route = createFileRoute("/stories/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`Cluster ${params.clusterId}`) }] }),
  loader: async ({ params }) => {
    const live = await getFeedClusterDetail({ data: { clusterId: params.clusterId } });
    if (live && "cluster" in live && live.cluster) {
      const cluster = storyClusterToUiCluster(live.cluster, 0);
      const stories = (live.articles ?? []).map((a) => articleToUiStory(a, cluster.id));
      return { cluster, stories, usingLiveFeed: true };
    }

    const cluster = clusterById(params.clusterId);
    if (!cluster) throw notFound();
    return {
      cluster,
      stories: storiesForCluster(cluster.id),
      usingLiveFeed: false,
    };
  },
  component: ClusterRoute,
  notFoundComponent: () => <div className="p-12 text-center">Cluster not found</div>,
});

function ClusterRoute() {
  const { cluster, stories } = Route.useLoaderData();
  return <ClusterView cluster={cluster} stories={stories} />;
}
