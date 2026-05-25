import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NewsArticle, StoryCluster, StoryConsensusReport } from "@/types/news-platform";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { runStoryConsensusForCluster } from "./analyze-cluster";
import {
  analyzeArticleHeavyweight,
  runHeavyweightClusterAnalysis,
} from "./analyze-cluster-heavyweight";
import { MIN_ARTICLES_FOR_CLUSTER_ANALYSIS } from "./constants";
import { getClusterArticles, getStoryConsensus, saveStoryConsensus } from "./store";
import {
  getArticleBundle,
  getClusterArticlesFromStore,
  getStoredCluster,
  updateClusterFromConsensus,
} from "../news/feed-store";
import { stableArticleId } from "../news/utils/text";
import type { PipelineArticleContext } from "../analysis/types";
import { computeAndStoreReliabilityScores, getReliabilityBundleByArticleId } from "../reliability/engine";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";

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

function articleToPipeline(article: NewsArticle): PipelineArticleContext {
  const text =
    article.fullText ??
    article.description ??
    article.ingestMetadata?.summary ??
    article.title;
  return {
    submissionId: article.id || stableArticleId(article.url),
    title: article.title,
    url: article.url,
    summary: article.description?.slice(0, 500) ?? article.title,
    analysisText: text.slice(0, 50_000),
    author: article.author,
    publishedAt: article.publishedAt,
    language: article.language ?? "en",
    contentRights: article.ingestMetadata?.contentPolicy === "feed_summary_only"
      ? "metadata_only"
      : "licensed_excerpt",
    rightsNote:
      article.ingestMetadata?.rightsNote ?? "Ingested feed summary for on-demand analysis.",
  };
}

async function ensureFeedConsensusReport(
  cluster: StoryCluster,
  articles: NewsArticle[],
): Promise<StoryConsensusReport> {
  const cached = getStoryConsensus(cluster.id);
  if (cached) return cached;
  const report =
    articles.length === 1
      ? await runHeavyweightClusterAnalysis(cluster, articles)
      : runStoryConsensusForCluster(cluster, articles);
  saveStoryConsensus(report);
  updateClusterFromConsensus(cluster.id, report);
  return report;
}

/** Live Top 100 cluster: return or build Oscar consensus analysis for the story. */
export const loadFeedClusterConsensus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => clusterIdSchema.parse(data))
  .handler(async ({ data }) => {
    const cluster = getStoredCluster(data.clusterId);
    if (!cluster) {
      return { error: { code: "NOT_FOUND", message: "Cluster not in feed" } };
    }
    const articles = getClusterArticlesFromStore(data.clusterId);
    if (articles.length < MIN_ARTICLES_FOR_CLUSTER_ANALYSIS) {
      return {
        error: {
          code: "INSUFFICIENT_COVERAGE",
          message: "No articles in this cluster to analyze.",
        },
        cluster,
      };
    }
    try {
      const report = await ensureFeedConsensusReport(cluster, articles);
      return { report, cluster };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Consensus analysis failed";
      return { error: { code: "CONSENSUS_FAILED", message }, cluster };
    }
  });

/** Single feed article: return or build full Oscar analysis report. */
export const loadFeedArticleAnalysis = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        clusterId: z.string().min(1),
        articleId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const cluster = getStoredCluster(data.clusterId);
    if (!cluster) {
      return { error: { code: "NOT_FOUND", message: "Cluster not in feed" } };
    }
    const articles = getClusterArticlesFromStore(data.clusterId);
    const article = articles.find(
      (a) => a.id === data.articleId || stableArticleId(a.url) === data.articleId,
    );
    if (!article) {
      return { error: { code: "NOT_FOUND", message: "Article not in this cluster" } };
    }

    const key = article.id || stableArticleId(article.url);
    let bundle = getArticleBundle(key);
    if (!bundle) {
      bundle = await analyzeArticleHeavyweight(article);
    }

    const reliability =
      getReliabilityBundleByArticleId(bundle.articleId) ??
      computeAndStoreReliabilityScores({
        report: bundle.report,
        results: bundle.results,
        article: articleToPipeline(article),
        reportId: `feed_${key}`,
        authorDisplayName: article.author,
      });

    if (!reliability) {
      return { error: { code: "ANALYSIS_FAILED", message: "Could not build reliability scores" } };
    }

    const explainability = buildFullExplainabilityBundle(
      bundle.report,
      reliability,
      bundle.results,
    );

    return {
      clusterId: data.clusterId,
      report: analysisReportToManualReport(bundle.report),
      platformReport: bundle.report,
      explainability,
    };
  });
