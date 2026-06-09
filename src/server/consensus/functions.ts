import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { NewsArticle, StoryCluster, StoryConsensusReport } from "@/types/news-platform";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { runStoryConsensusForCluster } from "./analyze-cluster";
import {
  bundleNeedsAiReanalysis,
  runHeavyweightClusterAnalysis,
} from "./analyze-cluster-heavyweight";
import { MIN_ARTICLES_FOR_CLUSTER_ANALYSIS } from "./constants";
import { getClusterArticles, getStoryConsensus, saveStoryConsensus } from "./store";
import { buildArticlePageScores, type ArticlePageScores } from "./article-page-scores";
import { mergeStoryIntoArticlePageScores } from "../news/article-score-store";
import {
  getArticleBundle,
  getArticleBundleHydrated,
  getArticlePageScores,
  getClusterArticlesFromStore,
  getStoredClusterHydrated,
  persistFeedToKv,
  saveArticlePageScores,
  updateClusterFromConsensus,
} from "../news/feed-store";
import { stableArticleId } from "../news/utils/text";
import type { PipelineArticleContext } from "../analysis/types";
import { computeAndStoreReliabilityScores, getReliabilityBundleByArticleId } from "../reliability/engine";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { buildTransparencyExplainabilityBundle } from "../transparency-explainability/build-bundle";
import { buildStoryScoreExplainability } from "../transparency-explainability/build-story-explainability";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { isFeedKvConfigured, runInWorkerBackground } from "../news/worker-env";

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
      const report = await runStoryConsensusForCluster(cluster, articles);
      saveStoryConsensus(report);
      return { report, storyExplainability: buildStoryScoreExplainability(report) };
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
    return { report, storyExplainability: buildStoryScoreExplainability(report) };
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

function syncStoryScoresToArticlePages(
  articles: NewsArticle[],
  storyReport: StoryConsensusReport,
): void {
  const story = {
    consensusScore: storyReport.consensusScore,
    disputeScore: storyReport.disputeScore,
    uncertaintyScore: storyReport.uncertaintyScore,
    storyConfidence: storyReport.storyConfidence,
  };
  const ids = articles.map((a) => a.id || stableArticleId(a.url));
  mergeStoryIntoArticlePageScores(story, ids);
}

function clusterArticlesNeedAiRefresh(articles: NewsArticle[]): boolean {
  return articles.some((a) => {
    const key = a.id || stableArticleId(a.url);
    const bundle = getArticleBundle(key);
    return !bundle?.report?.multiModelVerification;
  });
}

async function ensureFeedConsensusReport(
  cluster: StoryCluster,
  articles: NewsArticle[],
): Promise<StoryConsensusReport> {
  ensureWorkerEnvFromPlatform();
  const cached = getStoryConsensus(cluster.id);
  if (cached && !clusterArticlesNeedAiRefresh(articles)) {
    syncStoryScoresToArticlePages(articles, cached);
    return cached;
  }
  const report = await runHeavyweightClusterAnalysis(cluster, articles);
  saveStoryConsensus(report);
  updateClusterFromConsensus(cluster.id, report);
  syncStoryScoresToArticlePages(articles, report);
  void persistFeedToKv();
  return report;
}

function kickFeedConsensusBackground(cluster: StoryCluster, articles: NewsArticle[]): void {
  runInWorkerBackground(
    ensureFeedConsensusReport(cluster, articles).catch((err) => {
      console.error("[consensus] background analysis failed:", err instanceof Error ? err.message : err);
    }),
  );
}

/** Live Top 100 cluster: return cached report quickly; refresh in background when needed. */
export const loadFeedClusterConsensus = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => clusterIdSchema.parse(data))
  .handler(async ({ data }) => {
    const cluster = await getStoredClusterHydrated(data.clusterId);
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

    ensureWorkerEnvFromPlatform();
    const cached = getStoryConsensus(data.clusterId);
    if (cached) {
      syncStoryScoresToArticlePages(articles, cached);
      if (clusterArticlesNeedAiRefresh(articles)) {
        kickFeedConsensusBackground(cluster, articles);
      }
      return {
        report: cached,
        cluster,
        storyExplainability: buildStoryScoreExplainability(cached),
        refreshing: clusterArticlesNeedAiRefresh(articles),
      };
    }

    kickFeedConsensusBackground(cluster, articles);
    return {
      pendingAnalysis: true as const,
      cluster,
      message: "Running live Oscar analysis for this story…",
    };
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
    const cluster = await getStoredClusterHydrated(data.clusterId);
    if (!cluster) {
      return { error: { code: "NOT_FOUND", message: "Cluster not in feed" } };
    }
    const articles = getClusterArticlesFromStore(data.clusterId);
    const article = articles.find(
      (a) =>
        a.id === data.articleId ||
        a.url === data.articleId ||
        stableArticleId(a.url) === data.articleId,
    );
    if (!article) {
      return { error: { code: "NOT_FOUND", message: "Article not in this cluster" } };
    }

    const key = article.id || stableArticleId(article.url);
    console.log("[loadFeedArticleAnalysis] articleId parsed:", key, "clusterId:", data.clusterId);
    const bundle = await getArticleBundleHydrated(key);
    const needsAnalysis = !bundle || bundleNeedsAiReanalysis(bundle);

    if (needsAnalysis) {
      console.log("[loadFeedArticleAnalysis] analysis required for", key);
      return {
        pendingAnalysis: true as const,
        clusterId: data.clusterId,
        articleId: key,
        title: article.title,
        message: "Running live Oscar analysis for this article…",
      };
    }

    let storyReport = getStoryConsensus(data.clusterId);
    if (!storyReport) {
      try {
        storyReport = await ensureFeedConsensusReport(cluster, articles);
      } catch {
        storyReport = undefined;
      }
    } else {
      syncStoryScoresToArticlePages(articles, storyReport);
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

    const articlePageScores = buildArticlePageScores(
      bundle.articleId,
      reliability,
      bundle.report,
      storyReport ?? null,
    );
    saveArticlePageScores(articlePageScores);
    void persistFeedToKv();

    let explainability: ReturnType<typeof buildTransparencyExplainabilityBundle> | undefined;
    try {
      explainability = buildTransparencyExplainabilityBundle({
        report: bundle.report,
        bundle: reliability,
        results: bundle.results,
        storyReport,
      });
    } catch (err) {
      console.warn(
        "[loadFeedArticleAnalysis] explainability build failed:",
        err instanceof Error ? err.message : err,
      );
    }

    return {
      clusterId: data.clusterId,
      report: analysisReportToManualReport(bundle.report),
      platformReport: bundle.report,
      articlePageScores,
      explainability,
      storyReport: storyReport ?? null,
      storyScores: articlePageScores.story,
    };
  });
