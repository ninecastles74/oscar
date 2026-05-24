import { createFileRoute, notFound } from "@tanstack/react-router";
import { clusterById } from "@/lib/mock-data";
import { CompareMatrixView } from "@/features/story-clusters/compare-matrix-view";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/compare/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`Source comparison · ${params.clusterId}`) }] }),
  loader: ({ params }) => {
    const cluster = clusterById(params.clusterId);
    if (!cluster) throw notFound();
    return { cluster };
  },
  component: CompareRoute,
  notFoundComponent: () => <div className="p-12 text-center">Cluster not found</div>,
});

function CompareRoute() {
  const { cluster } = Route.useLoaderData();
  return <CompareMatrixView cluster={cluster} />;
}
