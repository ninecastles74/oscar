import type { StoryCluster } from "@/types/news-platform";
import type { Cluster } from "@/lib/mock-data/types";

/** Map live feed cluster to UI list shape (Top 100 table). */
export function storyClusterToUiCluster(c: StoryCluster, index: number): Cluster {
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    category: c.category,
    storyCount: c.storyCount ?? c.articleIds?.length ?? 0,
    confidence: c.confidence,
    disputedClaims: c.disputedClaims ?? 0,
    missingContext: c.missingContext ?? 0,
    publishedAt: c.publishedAt,
    storyIds: c.articleIds ?? [],
    claimIds: [],
    trendingScore: c.trendingScore ?? 100 - index,
  };
}
