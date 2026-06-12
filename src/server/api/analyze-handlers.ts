import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { buildFinalAnalysisReport } from "@/lib/final-analysis-report";
import { runGatedUserAnalysis } from "../analysis/api-run";
import { getManualAnalysisResult, getManualAnalysisStatus } from "../analysis/manual";
import { loadManualReliability } from "../analysis/manual-persist";
import { analyzeArticleHeavyweight, bundleNeedsAiReanalysis } from "../consensus/analyze-cluster-heavyweight";
import { buildArticlePageScores } from "../consensus/article-page-scores";
import { getStoryConsensus } from "../consensus/store";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import {
  getArticleBundleHydrated,
  getClusterArticlesFromStore,
  getStoredClusterHydrated,
  listAllStoredArticles,
  persistFeedToKv,
  ensureFeedHydratedFromKv,
} from "../news/feed-store";
import { isFeedKvConfigured } from "../news/worker-env";
import { stableArticleId } from "../news/utils/text";
import { computeAndStoreReliabilityScores, getReliabilityBundleByArticleId } from "../reliability/engine";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "../reliability/snapshots";
import { buildTransparencyExplainabilityBundle } from "../transparency-explainability/build-bundle";
import type { PipelineArticleContext } from "../analysis/types";
import type { NewsArticle } from "@/types/news-platform";
import { jsonError, jsonOk } from "./response";

const actorSchema = z.object({
  accessToken: z.string().optional(),
  anonymousId: z.string().max(128).optional(),
});

const textSchema = actorSchema.extend({
  text: z.string().min(80).max(100_000),
  title: z.string().max(300).optional(),
  userNotes: z.string().max(2000).optional(),
  language: z.string().min(2).max(5).optional(),
});

const urlSchema = actorSchema.extend({
  url: z.string().url(),
  title: z.string().max(300).optional(),
  userNotes: z.string().max(2000).optional(),
  language: z.string().min(2).max(5).optional(),
});

const articleSchema = z.object({
  articleId: z.string().min(1),
  clusterId: z.string().min(1).optional(),
  sync: z.boolean().optional(),
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

async function resolveFeedArticle(articleId: string, clusterId?: string) {
  if (clusterId) {
    await getStoredClusterHydrated(clusterId);
    const articles = getClusterArticlesFromStore(clusterId);
    const article = articles.find(
      (a) =>
        a.id === articleId ||
        a.url === articleId ||
        stableArticleId(a.url) === articleId,
    );
    if (article) {
      return {
        article,
        clusterId,
        key: article.id || stableArticleId(article.url),
      };
    }
  }

  await ensureFeedHydratedFromKv();
  const hit = listAllStoredArticles().find(
    (a) =>
      a.id === articleId ||
      a.url === articleId ||
      stableArticleId(a.url) === articleId,
  );
  if (!hit?.clusterId) return null;
  return {
    article: hit,
    clusterId: hit.clusterId,
    key: hit.id || stableArticleId(hit.url),
  };
}

async function buildArticleAnalysisResponse(
  clusterId: string,
  article: NewsArticle,
  key: string,
) {
  const bundle = await getArticleBundleHydrated(key);
  if (!bundle) return null;

  const storyReport = getStoryConsensus(clusterId);
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
    throw new Error("Could not build reliability scores");
  }

  const articlePageScores = buildArticlePageScores(
    bundle.articleId,
    reliability,
    bundle.report,
    storyReport ?? null,
  );

  let explainability;
  try {
    explainability = buildTransparencyExplainabilityBundle({
      report: bundle.report,
      bundle: reliability,
      results: bundle.results,
      storyReport,
    });
  } catch (err) {
    console.warn(
      "[api/analyze/article] explainability failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return {
    clusterId,
    articleId: key,
    report: analysisReportToManualReport(bundle.report),
    platformReport: bundle.report,
    reliability,
    explainability,
    finalAnalysis: buildFinalAnalysisReport({
      report: bundle.report,
      reliability,
      explainability,
      stagesCompleted: ["verification", "multi_model", "reliability", "claim_consensus"],
      stagesFailedOrLimited: bundle.report.pipelineWarnings?.map((w) => w.code) ?? [],
    }),
    articlePageScores,
    storyReport: storyReport ?? null,
  };
}

export async function handleAnalyzeText(request: Request): Promise<Response> {
  console.log("[api/analyze/text] route hit");
  ensureWorkerEnvFromPlatform();
  const raw = await request.json().catch(() => null);
  console.log("[api/analyze/text] body received:", raw ? "yes" : "no");
  const parsed = textSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid request body", {
      status: 400,
      details: parsed.error.message,
      code: "VALIDATION_ERROR",
    });
  }

  return handleManualAnalysisResult(await runGatedUserAnalysis(parsed.data));
}

export async function handleAnalyzeUrl(request: Request): Promise<Response> {
  console.log("[api/analyze/url] route hit");
  ensureWorkerEnvFromPlatform();
  const raw = await request.json().catch(() => null);
  console.log("[api/analyze/url] body received:", raw ? "yes" : "no");
  const parsed = urlSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid request body", {
      status: 400,
      details: parsed.error.message,
      code: "VALIDATION_ERROR",
    });
  }

  return handleManualAnalysisResult(await runGatedUserAnalysis(parsed.data));
}

function handleManualAnalysisResult(
  result: Awaited<ReturnType<typeof runGatedUserAnalysis>>,
): Response {
  if ("error" in result && result.error) {
    console.log("[api/analyze] gate error:", result.error.code, result.error.message);
    return jsonError(result.error.message, {
      status: result.error.statusCode ?? 400,
      code: result.error.code,
      extra: result.error.quota ? { quota: result.error.quota } : undefined,
    });
  }

  const platformReport = result.analysisSnapshot?.report;
  let explainability;
  if (platformReport && result.analysisSnapshot?.reliability) {
    try {
      explainability = buildFullExplainabilityBundle(
        platformReport,
        result.analysisSnapshot.reliability,
        getVerificationSnapshot(result.requestId)?.results,
      );
    } catch (err) {
      console.warn(
        "[api/analyze] explainability skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (result.status === "failed") {
    console.error("[api/analyze] pipeline failed:", result.failedMessage);
    return jsonError(result.failedMessage ?? "Analysis failed", {
      status: 500,
      code: "ANALYSIS_FAILED",
      details: result.failedMessage,
      extra: { requestId: result.requestId, status: result.status },
    });
  }

  if (result.status === "completed" && !platformReport) {
    return jsonError("Analysis completed but report could not be loaded", {
      status: 500,
      code: "LOAD_FAILED",
      details: "Enable FEED_KV for cross-request persistence or retry.",
      extra: { requestId: result.requestId },
    });
  }

  console.log("[api/analyze] pipeline completed", {
    requestId: result.requestId,
    status: result.status,
    claims: platformReport?.claims?.length ?? 0,
  });

  const finalAnalysis =
    platformReport && result.analysisSnapshot
      ? buildFinalAnalysisReport({
          report: platformReport,
          reliability: result.analysisSnapshot.reliability,
          explainability,
          stagesCompleted: platformReport.multiModelVerification
            ? ["verification", "multi_model", "reliability"]
            : ["verification", "reliability"],
          stagesFailedOrLimited:
            platformReport.pipelineWarnings?.map((w) => w.code) ??
            (result.analysisSnapshot.reliability ? [] : ["reliability_optional"]),
        })
      : undefined;

  return jsonOk({
    requestId: result.requestId,
    submissionId: result.submissionId,
    status: result.status,
    quota: result.quota,
    kvConfigured: result.kvConfigured,
    analysisSnapshot: result.analysisSnapshot,
    platformReport,
    report: platformReport ? analysisReportToManualReport(platformReport) : undefined,
    explainability,
    finalAnalysis,
    finalIntelligence: result.analysisSnapshot?.finalIntelligence,
    failedMessage: result.failedMessage,
    envWarning: result.envWarning,
  });
}

export async function handleAnalyzeArticle(request: Request): Promise<Response> {
  console.log("[api/analyze/article] route hit");
  ensureWorkerEnvFromPlatform();
  await ensureFeedHydratedFromKv();
  const raw = await request.json().catch(() => null);
  console.log("[api/analyze/article] body received:", raw ? "yes" : "no");
  const parsed = articleSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid request body", {
      status: 400,
      details: parsed.error.message,
      code: "VALIDATION_ERROR",
    });
  }

  const { articleId, clusterId } = parsed.data;
  console.log("[api/analyze/article] articleId parsed:", articleId, "clusterId:", clusterId ?? "(search)");
  console.log("[api/analyze/article] gemini configured:", isGoogleAiConfigured());

  if (!isGoogleAiConfigured()) {
    return jsonError("Live analysis requires GEMINI_API_KEY on the oscar Worker", {
      status: 503,
      code: "LIVE_AI_REQUIRED",
    });
  }

  const resolved = await resolveFeedArticle(articleId, clusterId);
  if (!resolved) {
    return jsonError("Article not found in feed", {
      status: 404,
      code: "NOT_FOUND",
      details: `No article matching id ${articleId}. Visit /stories to bootstrap the feed first.`,
    });
  }

  const { article, key } = resolved;
  const cachedBundle = await getArticleBundleHydrated(key);
  if (cachedBundle && !bundleNeedsAiReanalysis(cachedBundle)) {
    const existing = await buildArticleAnalysisResponse(resolved.clusterId, article, key);
    if (existing) {
      console.log("[api/analyze/article] returning cached analysis for", key);
      return jsonOk({ status: "completed" as const, ...existing });
    }
  }

  const runAnalysis = async () => {
    console.log("[api/analyze/article] pipeline started for", key);
    try {
      await analyzeArticleHeavyweight(article);
      await persistFeedToKv();
      console.log("[api/analyze/article] pipeline completed for", key);
    } catch (err) {
      console.error(
        "[api/analyze/article] pipeline failed:",
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  };

  try {
    await runAnalysis();
    const payload = await buildArticleAnalysisResponse(resolved.clusterId, article, key);
    if (!payload) {
      return jsonError("Analysis finished but results could not be loaded", {
        status: 500,
        code: "LOAD_FAILED",
        details: isFeedKvConfigured()
          ? undefined
          : "FEED_KV is not bound — analysis may not persist across requests.",
      });
    }
    console.log("[api/analyze/article] returning completed analysis for", key);
    return jsonOk({ status: "completed" as const, ...payload });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("[api/analyze/article] failed for", key, details);
    return jsonError("Article analysis failed", {
      status: 500,
      code: "ANALYSIS_FAILED",
      details,
    });
  }
}

export async function handleGetManualAnalysis(requestId: string): Promise<Response> {
  console.log("[api/analyze/status] poll", requestId);
  ensureWorkerEnvFromPlatform();

  const result = await getManualAnalysisResult(requestId);
  if (result) {
    let explainability;
    let finalAnalysis;
    if (result.reliability) {
      try {
        explainability = buildFullExplainabilityBundle(
          result.report,
          result.reliability,
          getVerificationSnapshot(result.request.id)?.results,
        );
        finalAnalysis = buildFinalAnalysisReport({
          report: result.report,
          reliability: result.reliability,
          explainability,
          stagesCompleted: ["verification", "multi_model", "reliability"],
          stagesFailedOrLimited: result.report.pipelineWarnings?.map((w) => w.code) ?? [],
        });
      } catch (err) {
        console.warn(
          "[api/analyze/status] explainability skipped:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return jsonOk({
      requestId: result.request.id,
      status: "completed" as const,
      report: analysisReportToManualReport(result.report),
      platformReport: result.report,
      reliability: result.reliability,
      explainability,
      finalAnalysis,
      finalIntelligence: result.finalIntelligence,
    });
  }

  const status = await getManualAnalysisStatus(requestId);
  if (!status) {
    return jsonError("Analysis request not found", {
      status: 404,
      code: "NOT_FOUND",
      details: `No record for ${requestId}. Enable FEED_KV or rerun analysis.`,
    });
  }

  if (status.status === "failed") {
    return jsonOk({
      requestId: status.id,
      status: "failed" as const,
      errorMessage: status.error ?? "Analysis failed",
    });
  }

  if (status.status === "completed" && status.report) {
    const reliability =
      status.reliability ??
      (await loadManualReliability(status.id)) ??
      undefined;
    let explainability;
    if (reliability) {
      try {
        explainability = buildFullExplainabilityBundle(
          status.report,
          reliability,
          getVerificationSnapshot(status.id)?.results,
        );
      } catch {
        /* optional */
      }
    }
    const finalAnalysis = buildFinalAnalysisReport({
      report: status.report,
      reliability,
      explainability,
      stagesCompleted: ["verification", "multi_model", "reliability"],
      stagesFailedOrLimited: status.report.pipelineWarnings?.map((w) => w.code) ?? [],
    });
    return jsonOk({
      requestId: status.id,
      status: "completed" as const,
      report: analysisReportToManualReport(status.report),
      platformReport: status.report,
      reliability,
      explainability,
      finalAnalysis,
      finalIntelligence: status.finalIntelligence,
    });
  }

  if (status.status === "completed") {
    return jsonOk({
      requestId: status.id,
      status: "failed" as const,
      errorMessage:
        status.error ??
        "Analysis finished but the report could not be loaded. Enable FEED_KV and retry.",
    });
  }

  return jsonOk({
    requestId: status.id,
    status: status.status,
    progress: status.progress,
    errorMessage: status.error,
    startedAt: status.startedAt,
  });
}
