import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { storyClusterToUiCluster } from "@/lib/feed-adapter";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import {
  getArticleBundleHydrated,
  getClusterArticlesFromStore,
  getFeedMeta,
  getStoredClusterHydrated,
  getTop100Clusters,
  listAllStoredArticles,
  ensureFeedHydratedFromKv,
  findClaimInFeed,
} from "../news/feed-store";
import { stableArticleId } from "../news/utils/text";
import { jsonError, jsonOk } from "./response";

export async function handleStoriesTop100(): Promise<Response> {
  console.log("[api/stories/top-100] route hit");
  ensureWorkerEnvFromPlatform();
  const clusters = await getTop100Clusters();
  const meta = getFeedMeta();
  return jsonOk({
    clusters: clusters.map((c, i) => storyClusterToUiCluster(c, i)),
    meta,
    count: clusters.length,
  });
}

export async function handleStoryById(clusterId: string): Promise<Response> {
  console.log("[api/stories/:id] route hit", clusterId);
  ensureWorkerEnvFromPlatform();
  const cluster = await getStoredClusterHydrated(clusterId);
  if (!cluster) {
    return jsonError("Story cluster not found", {
      status: 404,
      code: "NOT_FOUND",
      details: `No cluster ${clusterId} in feed`,
    });
  }
  const articles = getClusterArticlesFromStore(clusterId);
  const report = getStoryConsensus(clusterId);
  return jsonOk({
    cluster,
    articles,
    consensusReport: report ?? null,
    storyExplainability: report ? buildStoryScoreExplainability(report) : null,
  });
}

export async function handleArticleById(articleId: string): Promise<Response> {
  console.log("[api/articles/:id] route hit", articleId);
  ensureWorkerEnvFromPlatform();
  await ensureFeedHydratedFromKv();

  const hit = listAllStoredArticles().find(
    (a) =>
      a.id === articleId ||
      a.url === articleId ||
      stableArticleId(a.url) === articleId,
  );
  if (!hit) {
    return jsonError("Article not found", {
      status: 404,
      code: "NOT_FOUND",
      details: `No article matching ${articleId}`,
    });
  }

  const key = hit.id || stableArticleId(hit.url);
  const bundle = await getArticleBundleHydrated(key);
  const reliability = getReliabilityBundleByArticleId(key);

  return jsonOk({
    article: hit,
    clusterId: hit.clusterId,
    analyzed: !!hit.analyzedAt,
    analysis: bundle
      ? {
          report: analysisReportToManualReport(bundle.report),
          platformReport: bundle.report,
          reliability: reliability ?? null,
        }
      : null,
  });
}

export async function handleExplain(entityType: string, entityId: string): Promise<Response> {
  console.log("[api/explain] route hit", entityType, entityId);
  ensureWorkerEnvFromPlatform();

  if (entityType === "claim") {
    await ensureFeedHydratedFromKv();
    const hit = findClaimInFeed(entityId);
    if (!hit) {
      return jsonError("Claim not found", { status: 404, code: "NOT_FOUND" });
    }
    const bundle = getReliabilityBundleByArticleId(hit.articleId);
    if (!bundle) {
      return jsonError("Reliability scores not available for this claim", {
        status: 404,
        code: "NOT_FOUND",
      });
    }
    const explainability = buildFullExplainabilityBundle(
      hit.report,
      bundle,
      getVerificationSnapshot(hit.articleId)?.results,
    );
    return jsonOk({ entityType, entityId, explainability });
  }

  if (entityType === "article") {
    await ensureFeedHydratedFromKv();
    const bundle = await getArticleBundleHydrated(entityId);
    if (!bundle) {
      return jsonError("Article analysis not found", { status: 404, code: "NOT_FOUND" });
    }
    const reliability = getReliabilityBundleByArticleId(entityId);
    if (!reliability) {
      return jsonError("Reliability scores not available", { status: 404, code: "NOT_FOUND" });
    }
    const explainability = buildFullExplainabilityBundle(
      bundle.report,
      reliability,
      getVerificationSnapshot(entityId)?.results,
    );
    return jsonOk({ entityType, entityId, explainability });
  }

  if (entityType === "story") {
    const report = getStoryConsensus(entityId);
    if (!report) {
      return jsonError("Story consensus not found", { status: 404, code: "NOT_FOUND" });
    }
    return jsonOk({
      entityType,
      entityId,
      explainability: buildStoryScoreExplainability(report),
    });
  }

  return jsonError("Unsupported entity type", {
    status: 400,
    code: "VALIDATION_ERROR",
    details: "Supported: article, claim, story",
  });
}

export async function handleDebugArticle(articleId: string): Promise<Response> {
  console.log("[api/debug/article/:id] route hit", articleId);
  ensureWorkerEnvFromPlatform();
  await ensureFeedHydratedFromKv();

  const hit = listAllStoredArticles().find(
    (a) =>
      a.id === articleId ||
      a.url === articleId ||
      stableArticleId(a.url) === articleId,
  );
  if (!hit) {
    return jsonError("Article not found", { status: 404, code: "NOT_FOUND" });
  }

  const key = hit.id || stableArticleId(hit.url);
  const bundle = await getArticleBundleHydrated(key);
  return jsonOk({
    articleId: key,
    clusterId: hit.clusterId,
    analyzedAt: hit.analyzedAt,
    hasBundle: !!bundle,
    claimCount: bundle?.report.claims.length ?? 0,
    hasMultiModel: !!bundle?.report.multiModelVerification,
  });
}
