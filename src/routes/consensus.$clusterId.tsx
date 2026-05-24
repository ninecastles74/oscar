import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { Cluster } from "@/lib/mock-data";
import { clusterById, sourceById, storiesForCluster } from "@/lib/mock-data";
import type { StoryConsensusReport } from "@/types/news-platform";
import { StoryConsensusView } from "@/features/story-clusters/story-consensus-view";
import { getStoryConsensusReport, runStoryConsensus } from "@/server/consensus/functions";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/consensus/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`${OSCAR.consensus} · ${params.clusterId}`) }] }),
  loader: async ({ params }) => {
    const cluster = clusterById(params.clusterId);
    if (!cluster) throw notFound();

    const cached = await getStoryConsensusReport({ data: { clusterId: params.clusterId } });
    if (cached && "consensusScore" in cached) {
      return { report: cached as StoryConsensusReport, cluster };
    }

    const stories = storiesForCluster(params.clusterId);
    if (stories.length < 2) {
      return { error: { message: "Need at least 2 articles for consensus" }, cluster };
    }

    const result = await runStoryConsensus({
      data: {
        clusterId: params.clusterId,
        title: cluster.title,
        summary: cluster.summary,
        articles: stories.map((s, i) => {
          const src = sourceById(s.sourceId);
          return {
            id: s.id ?? `art_${params.clusterId}_${i}`,
            title: s.headline,
            url: s.url,
            description: s.summary,
            sourceName: src?.name ?? s.sourceId,
            sourceDomain: src?.domain ?? "unknown",
            sourceId: s.sourceId,
            publishedAt: s.publishedAt,
          };
        }),
      },
    });

    if (result && "error" in result && result.error) {
      return { error: result.error, cluster };
    }
    if (result && "consensusScore" in result) {
      return { report: result, cluster };
    }
    return { error: { message: "Consensus analysis failed" }, cluster };
  },
  component: ConsensusRoute,
  notFoundComponent: () => <div className="p-12 text-center">Story not found</div>,
});

type LoaderData =
  | { report: StoryConsensusReport; cluster: Cluster }
  | { error: { message: string }; cluster: Cluster };

function ConsensusRoute() {
  const data = Route.useLoaderData() as LoaderData;

  if ("error" in data && data.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Consensus unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link
          to="/stories/$clusterId"
          params={{ clusterId: data.cluster.id }}
          className="mt-6 inline-block text-sm text-accent hover:underline"
        >
          Back to story
        </Link>
      </main>
    );
  }

  if (!("report" in data) || !data.report) {
    return null;
  }

  return <StoryConsensusView report={data.report} />;
}
