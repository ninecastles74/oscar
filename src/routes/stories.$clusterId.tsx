import { createFileRoute, notFound } from "@tanstack/react-router";
import { clusterById } from "@/lib/mock-data";
import { ClusterView } from "@/features/story-clusters/cluster-view";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/stories/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`Cluster ${params.clusterId}`) }] }),
  loader: ({ params }) => {
    const cluster = clusterById(params.clusterId);
    if (!cluster) throw notFound();
    return { cluster };
  },
  component: ClusterRoute,
  notFoundComponent: () => <div className="p-12 text-center">Cluster not found</div>,
});

function ClusterRoute() {
  const { cluster } = Route.useLoaderData();
  return <ClusterView cluster={cluster} />;
}
