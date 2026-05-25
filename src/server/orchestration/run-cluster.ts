import { runHeavyweightClusterAnalysis } from "../consensus/analyze-cluster-heavyweight";
import { buildStoryConsensusIntelligence } from "../consensus/story-intelligence";
import { getArticleBundle } from "../news/feed-store";
import { stableArticleId } from "../news/utils/text";
import { buildStoryScoreExplainability } from "../transparency-explainability/build-story-explainability";
import type { ClusterOrchestrationInput, ClusterOrchestrationReport } from "./types";

/**
 * Cluster orchestration — per-article heavyweight analysis, story consensus,
 * optional story intelligence, and transparency explainability.
 */
export async function runClusterAnalysisOrchestration(
  input: ClusterOrchestrationInput,
): Promise<ClusterOrchestrationReport> {
  const stages: ClusterOrchestrationReport["stagesCompleted"] = [];

  const storyConsensus = await runHeavyweightClusterAnalysis(
    input.cluster,
    input.articles,
    { onlyAnalyzeArticleIds: input.onlyAnalyzeArticleIds },
  );
  stages.push("verification", "multi_model", "reliability", "claim_consensus", "story_consensus");

  let storyIntelligence: ClusterOrchestrationReport["storyIntelligence"];
  if (input.includeStoryIntelligence !== false) {
    const bundles = input.articles
      .slice(0, 12)
      .map((a) => getArticleBundle(a.id || stableArticleId(a.url)))
      .filter((b): b is NonNullable<typeof b> => !!b);
    if (bundles.length > 0) {
      storyIntelligence = buildStoryConsensusIntelligence({
        clusterId: input.cluster.id,
        title: input.cluster.title,
        articles: bundles,
      });
      stages.push("story_intelligence");
    }
  }

  const storyExplainability = buildStoryScoreExplainability(
    storyConsensus,
    storyIntelligence,
  );
  stages.push("transparency");

  return {
    clusterId: input.cluster.id,
    storyConsensus,
    storyExplainability,
    storyIntelligence,
    articlesAnalyzed: storyConsensus.articleCount,
    stagesCompleted: [...new Set(stages)],
    computedAt: new Date().toISOString(),
  };
}
