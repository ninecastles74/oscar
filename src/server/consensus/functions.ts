import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NewsArticle, StoryCluster } from "@/types/news-platform";
import { runStoryConsensusForCluster, runStoryConsensusFromArticles } from "./analyze-cluster";
import { getClusterArticles, getStoryConsensus, saveStoryConsensus } from "./store";

const clusterIdSchema = z.object({ clusterId: z.string().min(1) });

const articlesSchema = z.object({
  clusterId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().optional(),
  articles: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      description: z.string().optional(),
      sourceName: z.string().optional(),
      sourceDomain: z.string().optional(),
      sourceId: z.string().optional(),
      publishedAt: z.string().optional(),
      language: z.string().optional(),
      fullText: z.string().optional(),
    }),
  ),
});

function toNewsArticle(
  raw: z.infer<typeof articlesSchema>["articles"][0],
  clusterId: string,
): NewsArticle {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    description: raw.description ?? raw.title,
    sourceName: raw.sourceName ?? "Unknown",
    sourceDomain: raw.sourceDomain ?? "unknown",
    sourceId: raw.sourceId,
    publishedAt: raw.publishedAt ?? new Date().toISOString(),
    originalApiProvider: "publishers",
    category: "General",
    language: raw.language ?? "en",
    fullText: raw.fullText,
    clusterId,
  };
}

/** Run consensus engine for a cluster (uses cached articles or provided payload). */
export const runStoryConsensus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => articlesSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const articles = data.articles.map((a) => toNewsArticle(a, data.clusterId));
      const cluster: StoryCluster = {
        id: data.clusterId,
        title: data.title,
        summary: data.summary ?? "",
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
      const report = runStoryConsensusForCluster(cluster, articles);
      saveStoryConsensus(report);
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Consensus analysis failed";
      return { error: { code: "CONSENSUS_FAILED", message } };
    }
  });

/** Fetch cached consensus report for a cluster. */
export const getStoryConsensusReport = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => clusterIdSchema.parse(data))
  .handler(async ({ data }) => {
    const report = getStoryConsensus(data.clusterId);
    if (!report) {
      return { error: { code: "NOT_FOUND", message: "No consensus report for this cluster" } };
    }
    return report;
  });
