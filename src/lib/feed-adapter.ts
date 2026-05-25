import type { NewsArticle, StoryCluster } from "@/types/news-platform";
import type { Cluster, Story } from "@/lib/mock-data/types";
import { normalizeImageUrl } from "@/lib/article-image";

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
    imageUrl: normalizeImageUrl(c.imageUrl),
    storyIds: c.articleIds ?? c.storyIds ?? [],
    claimIds: c.claimIds ?? [],
    trendingScore: c.trendingScore ?? 100 - index,
    primarySourceName: c.primarySourceName,
    sourceNames: c.sourceNames,
  };
}

/** Map ingested article to coverage list item on cluster detail. */
export function articleToUiStory(article: NewsArticle, clusterId: string): Story {
  const domain = article.sourceDomain.replace(/^www\./, "");
  return {
    id: article.id || article.url,
    clusterId,
    headline: article.title,
    summary: article.description.slice(0, 280),
    publishedAt: article.publishedAt,
    sourceId: article.sourceId ?? domain,
    url: article.url,
    category: article.category,
    imageUrl: normalizeImageUrl(article.imageUrl),
  };
}
