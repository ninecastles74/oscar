import type { NewsArticle, StoryCluster, StoryConsensusReport } from "@/types/news-platform";
import { runHeavyweightClusterAnalysis } from "./analyze-cluster-heavyweight";

/**
 * Story consensus: every article runs full verification + multi-model AI first.
 * Cross-source alignment is rule-based on top of AI-analyzed per-article reports.
 */
export async function runStoryConsensusForCluster(
  cluster: StoryCluster,
  articles: NewsArticle[],
): Promise<StoryConsensusReport> {
  return runHeavyweightClusterAnalysis(cluster, articles);
}

export async function runStoryConsensusFromArticles(
  clusterId: string,
  title: string,
  articles: NewsArticle[],
): Promise<StoryConsensusReport> {
  const cluster: StoryCluster = {
    id: clusterId,
    title,
    summary: "",
    category: "General",
    storyCount: articles.length,
    confidence: 0,
    disputedClaims: 0,
    missingContext: 0,
    publishedAt: new Date().toISOString(),
    articleIds: articles.map((a) => a.id),
    claimIds: [],
    trendingScore: 0,
  };
  return runHeavyweightClusterAnalysis(cluster, articles);
}

/** @deprecated Use analyzeArticleHeavyweight — sync heuristic-only bundles are removed. */
export function buildArticleBundle(article: NewsArticle): never {
  throw new Error(
    "buildArticleBundle is removed; use analyzeArticleHeavyweight for AI-backed analysis.",
  );
}
