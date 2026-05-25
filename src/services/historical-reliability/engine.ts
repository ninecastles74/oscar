import {
  buildTrendGraphResponse,
  getAuthorReliabilityTrend,
  getContradictionTrend,
  getEntityTrendDashboard,
  getSourceReliabilityTrend,
  getTopicReliabilityTrend,
  type TrendAnalyticsQuery,
} from "@/server/reliability/analytics/trend-analytics.service";
import {
  computeAndStoreReliabilityScores,
  getReliabilityBundleByArticleId,
  recalculateReliabilityScores,
  type ComputeReliabilityInput,
} from "@/server/reliability/engine";
import { queryHistoricalSnapshots } from "@/server/reliability/historical/snapshot-store";
import type { ReliabilityScoreBundle } from "@/types/news-platform";
import {
  computeHistoricalReliabilityScore,
  resolvePrimaryTrendDirection,
  resolveRollingAverage,
} from "./scoring";
import type {
  HistoricalEntityProfile,
  HistoricalReliabilityAnalysisJson,
  HistoricalReliabilitySnapshotQuery,
  HistoricalReliabilityTrendJson,
  HistoricalScoreSnapshotRecord,
} from "./types";

function buildEntityProfiles(bundle: ReliabilityScoreBundle): HistoricalEntityProfile[] {
  const profiles: HistoricalEntityProfile[] = [
    {
      entityType: "article",
      entityId: bundle.article.articleId,
      label: bundle.article.title,
      overallScore: bundle.article.overallScore,
      rollingAverage: bundle.trends.article.rollingAverage,
      trendDirection: bundle.trends.article.direction,
      articlesScored: 1,
    },
  ];

  if (bundle.organization) {
    profiles.push({
      entityType: "source",
      entityId: bundle.organization.organizationId,
      label: bundle.organization.name,
      overallScore: bundle.organization.overallScore,
      rollingAverage: bundle.organization.rollingAverage,
      trendDirection: bundle.organization.trend.direction,
      articlesScored: bundle.organization.articlesScored,
    });
  }

  if (bundle.author) {
    profiles.push({
      entityType: "author",
      entityId: bundle.author.authorId,
      label: bundle.author.displayName,
      overallScore: bundle.author.overallScore,
      rollingAverage: bundle.author.rollingAverage,
      trendDirection: bundle.author.trend.direction,
      articlesScored: bundle.author.articlesScored,
    });
  }

  const topic = bundle.topics[0];
  if (topic) {
    profiles.push({
      entityType: "topic",
      entityId: topic.topic,
      label: topic.topic,
      overallScore: topic.overallScore,
      rollingAverage: topic.rollingAverage,
      trendDirection: topic.trend.direction,
      articlesScored: topic.articlesScored,
    });
  }

  return profiles;
}

/**
 * Historical Reliability Engine — structured JSON over rolling scores,
 * snapshot history, and trend analytics. Does not declare objective truth.
 */
export function analyzeHistoricalReliability(
  bundle: ReliabilityScoreBundle,
): HistoricalReliabilityAnalysisJson {
  const cat = Object.fromEntries(bundle.article.categories.map((c) => [c.id, c.score]));

  return {
    historicalReliabilityScore: computeHistoricalReliabilityScore(bundle),
    organizationScore: bundle.organization?.overallScore ?? null,
    articleScore: bundle.article.overallScore,
    authorScore: bundle.author?.overallScore ?? null,
    topicScore: bundle.topics[0]?.overallScore ?? null,
    corroborationScore: bundle.organization?.corroborationConfidence ?? cat.cross_source_corroboration ?? null,
    contradictionDetectionScore: cat.contradiction_detection ?? null,
    sensationalismScore: cat.sensationalism ?? null,
    sourceTransparencyScore: bundle.organization?.sourceTransparency ?? cat.source_transparency ?? null,
    reportingConsistencyScore: bundle.organization?.reportingConsistency ?? cat.context_completeness ?? null,
    trendDirection: resolvePrimaryTrendDirection(bundle),
    rollingAverage: resolveRollingAverage(bundle),
    sampleSize: bundle.history.length,
    entityProfiles: buildEntityProfiles(bundle),
    categoryScores: bundle.article.categories,
    computedAt: bundle.computedAt,
  };
}

export function computeHistoricalReliability(
  input: ComputeReliabilityInput,
): HistoricalReliabilityAnalysisJson {
  const bundle = computeAndStoreReliabilityScores(input);
  return analyzeHistoricalReliability(bundle);
}

export function recalculateHistoricalReliability(
  reportId: string,
  input?: ComputeReliabilityInput,
): HistoricalReliabilityAnalysisJson | null {
  const bundle = recalculateReliabilityScores(reportId, input);
  return bundle ? analyzeHistoricalReliability(bundle) : null;
}

export function getHistoricalReliabilityByArticleId(
  articleId: string,
  version?: number,
): HistoricalReliabilityAnalysisJson | null {
  const bundle = getReliabilityBundleByArticleId(articleId, version);
  return bundle ? analyzeHistoricalReliability(bundle) : null;
}

export function queryHistoricalReliabilityTrend(
  query: TrendAnalyticsQuery,
): HistoricalReliabilityTrendJson {
  return buildTrendGraphResponse(query);
}

export function queryHistoricalReliabilitySnapshots(
  query: HistoricalReliabilitySnapshotQuery,
): HistoricalScoreSnapshotRecord[] {
  return queryHistoricalSnapshots(query);
}

export {
  getSourceReliabilityTrend,
  getAuthorReliabilityTrend,
  getTopicReliabilityTrend,
  getContradictionTrend,
  getEntityTrendDashboard,
};
