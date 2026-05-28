import type { NewsArticle, StoryCluster, StoryConsensusReport } from "@/types/news-platform";
import { enrichVerificationWithMultiModel } from "../multi-model";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { runVerificationPipeline } from "../analysis/verification";
import { computeAndStoreReliabilityScores } from "../reliability/engine";
import { applyClaimConsensusToReport } from "../consensus-engine";
import { extractDomain } from "../news/utils/url";
import { stableArticleId } from "../news/utils/text";
import { buildArticlePageScores } from "./article-page-scores";
import {
  getArticleBundle,
  markArticleAnalyzed,
  updateClusterFromConsensus,
} from "../news/feed-store";
import type { PipelineArticleContext } from "../analysis/types";
import { buildStoryConsensus } from "./build-consensus";
import { enrichStoryConsensusWithGemini } from "./enrich-story-consensus-ai";
import { assertLiveAnalysisReport } from "../analysis/live-ai-guard";
import { MIN_ARTICLES_FOR_CLUSTER_ANALYSIS } from "./constants";
import type { AnalyzedArticleBundle, StoryConsensusInput } from "./types";

const MAX_ARTICLES_PER_CONSENSUS = 12;

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
      article.ingestMetadata?.rightsNote ??
      "Scheduled feed analysis (summary/excerpt).",
  };
}

/** Full pipeline + multi-model + reliability for one article (scheduled, no user quota). */
function bundleNeedsAiReanalysis(bundle: AnalyzedArticleBundle): boolean {
  if (!bundle.report.multiModelVerification) return true;
  const live = bundle.report.multiModelVerification.geminiUsage?.liveApiCalls ?? 0;
  return live === 0;
}

export async function analyzeArticleHeavyweight(
  article: NewsArticle,
  options?: { force?: boolean },
): Promise<AnalyzedArticleBundle> {
  ensureWorkerEnvFromPlatform();
  const key = article.id || stableArticleId(article.url);
  const existing = getArticleBundle(key);
  if (existing && !options?.force && !bundleNeedsAiReanalysis(existing)) return existing;

  const ctx = articleToPipeline(article);
  let bundle = await runVerificationPipeline(ctx);
  bundle = await enrichVerificationWithMultiModel(bundle, "scheduled");
  assertLiveAnalysisReport(bundle.report, bundle.stages);
  const { report, results } = bundle;

  const reliability = computeAndStoreReliabilityScores({
    report,
    results,
    article: ctx,
    reportId: `sched_${ctx.submissionId}`,
  });
  const reportWithConsensus = applyClaimConsensusToReport(report, reliability);

  const domain = article.sourceDomain ?? extractDomain(article.url);
  const sourceId = article.sourceId ?? domain.replace(/\./g, "_");
  const analyzed: AnalyzedArticleBundle = {
    articleId: ctx.submissionId,
    url: article.url,
    title: article.title,
    sourceId,
    sourceName: article.sourceName ?? domain,
    sourceDomain: domain,
    publishedAt: article.publishedAt,
    analysisText: ctx.analysisText,
    report: reportWithConsensus,
    results,
  };

  const pageScores = buildArticlePageScores(
    analyzed.articleId,
    reliability,
    reportWithConsensus,
    null,
  );
  markArticleAnalyzed(analyzed.articleId, analyzed, pageScores);
  return analyzed;
}

/**
 * Heavyweight cluster analysis: multi-model per unanalyzed article, full story consensus.
 */
export async function runHeavyweightClusterAnalysis(
  cluster: StoryCluster,
  articles: NewsArticle[],
  options?: { onlyAnalyzeArticleIds?: string[] },
): Promise<StoryConsensusReport> {
  const only = options?.onlyAnalyzeArticleIds
    ? new Set(options.onlyAnalyzeArticleIds)
    : null;

  const members = articles
    .filter((a) => a.clusterId === cluster.id || cluster.articleIds?.includes(a.id))
    .slice(0, MAX_ARTICLES_PER_CONSENSUS);

  const clusterArticles =
    members.length > 0 ? members : articles.slice(0, MAX_ARTICLES_PER_CONSENSUS);

  if (clusterArticles.length < MIN_ARTICLES_FOR_CLUSTER_ANALYSIS) {
    throw new Error("Story analysis requires at least one article in this cluster.");
  }

  const analyzed: AnalyzedArticleBundle[] = [];
  for (const article of clusterArticles) {
    const key = article.id || stableArticleId(article.url);
    let bundle = getArticleBundle(key);
    if (!bundle) {
      if (only && !only.has(key)) continue;
      bundle = await analyzeArticleHeavyweight(article);
    }
    analyzed.push(bundle);
  }

  if (analyzed.length < MIN_ARTICLES_FOR_CLUSTER_ANALYSIS) {
    throw new Error("Not enough analyzed articles for cluster analysis.");
  }

  const input: StoryConsensusInput = {
    clusterId: cluster.id,
    title: cluster.title,
    summary: cluster.summary,
    articles: analyzed,
  };
  let report = buildStoryConsensus(input);
  report = await enrichStoryConsensusWithGemini(report, input);
  updateClusterFromConsensus(cluster.id, report);
  return report;
}
