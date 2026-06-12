import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getFeedCluster } from "@/server/news/functions";

export const Route = createFileRoute("/stories/$clusterId")({
  loader: async ({ params }) => {
    const live = await getFeedCluster({ data: { clusterId: params.clusterId } });
    const inFeed = live && "cluster" in live && live.cluster;
    if (!inFeed) throw notFound();

    throw redirect({
      to: "/consensus/$clusterId",
      params: { clusterId: params.clusterId },
    });
  },
});
