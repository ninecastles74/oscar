import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { Cluster } from "@/lib/mock-data";
import { clusterById, sourceById, storiesForCluster } from "@/lib/mock-data";
import type { ScoreExplainability, StoryConsensusReport } from "@/types/news-platform";
import { StoryConsensusView } from "@/features/story-clusters/story-consensus-view";
import {
  getStoryConsensusReport,
  loadFeedClusterConsensus,
  runStoryConsensus,
} from "@/server/consensus/functions";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/consensus/$clusterId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`${OSCAR.consensus} · ${params.clusterId}`) }] }),
  loader: async ({ params }) => {
    const live = await loadFeedClusterConsensus({ data: { clusterId: params.clusterId } });
    if (live && "report" in live && live.report) {
      return {
        report: live.report as StoryConsensusReport,
        cluster: storyClusterToUiCluster(live.cluster, 0),
        storyExplainability: (live as { storyExplainability?: ScoreExplainability })
          .storyExplainability,
      };
    }
    if (live && "error" in live && live.error && live.cluster) {
      return {
        error: live.error,
        cluster: storyClusterToUiCluster(live.cluster, 0),
      };
    }

    const cluster = clusterById(params.clusterId);
    if (!cluster) throw notFound();

    const cached = await getStoryConsensusReport({ data: { clusterId: params.clusterId } });
    if (cached && "report" in cached && cached.report) {
      return {
        report: cached.report as StoryConsensusReport,
        cluster,
        storyExplainability: cached.storyExplainability as ScoreExplainability | undefined,
      };
    }

    const stories = storiesForCluster(params.clusterId);
    if (stories.length < 1) {
      return { error: { message: "No articles in this cluster to analyze" }, cluster };
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
    if (result && "report" in result && result.report) {
      return {
        report: result.report as StoryConsensusReport,
        cluster,
        storyExplainability: result.storyExplainability as ScoreExplainability | undefined,
      };
    }
    return { error: { message: "Consensus analysis failed" }, cluster };
  },
  component: ConsensusRoute,
  notFoundComponent: () => <div className="p-12 text-center">Story not found</div>,
});

type LoaderData =
  | {
      report: StoryConsensusReport;
      cluster: Cluster;
      storyExplainability?: ScoreExplainability;
    }
  | { error: { message: string; code?: string }; cluster: Cluster };

function ConsensusRoute() {
  const data = Route.useLoaderData() as LoaderData;

  if ("error" in data && data.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Analysis unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link to="/stories" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to Top 100
        </Link>
      </main>
    );
  }

  if (!("report" in data) || !data.report) {
    return null;
  }

  return (
    <StoryConsensusView
      report={data.report}
      storyExplainability={"storyExplainability" in data ? data.storyExplainability : undefined}
    />
  );
}
