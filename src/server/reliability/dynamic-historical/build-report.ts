import type { Category, HistoricalEntityType, TrendGraphPoint } from "@/types/news-platform";
import { backfillSnapshotsFromHistory } from "../historical/backfill-from-history";
import { queryHistoricalSnapshots } from "../historical/snapshot-store";
import {
  getReliabilityBundleByArticleId,
  recalculateReliabilityScores,
} from "../engine";
import {
  getAllTopicSourceReliabilityForOrg,
  getTopicSourceReliabilityHistory,
} from "../topics/topic-source-store";
import { buildReliabilityTrend } from "../services/trend.service";
import { clampScore } from "../utils/math";
import { buildConfidenceTrend, buildReliabilityWindowTrend } from "./window-trends";
import type {
  DynamicHistoricalReliabilityInput,
  DynamicHistoricalReliabilityReport,
  TopicReliabilitySlice,
} from "./types";

function snapshotsToPoints(
  entityType: HistoricalEntityType,
  entityId: string,
  metricType: import("@/types/news-platform").HistoricalMetricType,
  topic?: Category,
): TrendGraphPoint[] {
  return queryHistoricalSnapshots({ entityType, entityId, metricType, topic }).map((s) => ({
    recordedAt: s.recordedAt,
    value: s.scoreValue,
  }));
}

function loadTopicReliabilitySlices(
  entityType: HistoricalEntityType,
  entityId: string,
): TopicReliabilitySlice[] {
  if (entityType !== "source") {
    const topicPoints = queryHistoricalSnapshots({
      entityType: "topic",
      metricType: "overall_score",
      topic: entityType === "topic" ? (entityId as Category) : undefined,
    });
    if (entityType === "topic") {
      const points = topicPoints.filter((s) => s.entityId === entityId);
      if (points.length === 0) return [];
      const history = points.map((p) => ({ recordedAt: p.recordedAt, score: p.scoreValue }));
      const trend = buildReliabilityTrend(history);
      return [
        {
          topic: entityId,
          overallScore: points[points.length - 1].scoreValue,
          rollingAverage: trend.rollingAverage,
          trendDirection: trend.direction,
          articlesScored: points.length,
        },
      ];
    }
    return [];
  }

  const rows = getAllTopicSourceReliabilityForOrg(entityId);
  return rows.map((r) => {
    const history = getTopicSourceReliabilityHistory(entityId, r.topic);
    const trend = buildReliabilityTrend(
      history.map((h) => ({ recordedAt: h.computedAt, score: h.overallScore })),
    );
    return {
      topic: r.topic,
      overallScore: r.overallScore,
      rollingAverage: r.rollingAverage,
      trendDirection: trend.direction,
      articlesScored: r.articlesScored,
    };
  });
}

function resolveHistoricalScore(
  entityType: HistoricalEntityType,
  entityId: string,
  overallPoints: TrendGraphPoint[],
): number {
  const bundle =
    entityType === "article" ? getReliabilityBundleByArticleId(entityId) : null;
  if (bundle) {
    return clampScore(
      bundle.organization?.overallScore ??
        bundle.article.overallScore ??
        overallPoints[overallPoints.length - 1]?.value ??
        50,
    );
  }
  const last = overallPoints[overallPoints.length - 1]?.value;
  return last !== undefined ? clampScore(last) : 50;
}

/**
 * Dynamic Historical Reliability Engine — rolling history, corrections,
 * contradiction frequency, evidence quality, topic scores; supports recalc on new evidence.
 */
export function buildDynamicHistoricalReliabilityReport(
  input: DynamicHistoricalReliabilityInput,
): DynamicHistoricalReliabilityReport {
  backfillSnapshotsFromHistory();

  let recalculated = false;
  if (input.recalculate?.reportId) {
    const bundle = recalculateReliabilityScores(
      input.recalculate.reportId,
      input.recalculate.compute,
    );
    recalculated = bundle !== null;
  }

  const { entityType, entityId, topic } = input;
  const asOf = input.asOf ?? new Date();

  const overallPoints = snapshotsToPoints(entityType, entityId, "overall_score", topic);
  const rollingPoints = snapshotsToPoints(entityType, entityId, "rolling_average", topic);
  const historyPoints = rollingPoints.length > 0 ? rollingPoints : overallPoints;

  const contradictionDetection = snapshotsToPoints(
    entityType,
    entityId,
    "contradiction_detection",
    topic,
  );
  const contradictionCount =
    entityType === "article"
      ? snapshotsToPoints(entityType, entityId, "contradiction_count", topic)
      : [];
  const contradictionPoints =
    contradictionDetection.length > 0 ? contradictionDetection : contradictionCount;

  const evidencePoints = snapshotsToPoints(entityType, entityId, "evidence_support", topic);
  const confidencePoints = snapshotsToPoints(entityType, entityId, "confidence", topic);

  const sevenDayTrend = buildReliabilityWindowTrend(
    historyPoints,
    contradictionPoints,
    evidencePoints,
    7,
    asOf,
  );
  const thirtyDayTrend = buildReliabilityWindowTrend(
    historyPoints,
    contradictionPoints,
    evidencePoints,
    30,
    asOf,
  );
  const ninetyDayTrend = buildReliabilityWindowTrend(
    historyPoints,
    contradictionPoints,
    evidencePoints,
    90,
    asOf,
  );
  const yearlyTrend = buildReliabilityWindowTrend(
    historyPoints,
    contradictionPoints,
    evidencePoints,
    365,
    asOf,
  );

  return {
    entityType,
    entityId,
    topic,
    sevenDayTrend,
    thirtyDayTrend,
    ninetyDayTrend,
    yearlyTrend,
    confidenceTrend: buildConfidenceTrend(confidencePoints, asOf),
    topicReliability: loadTopicReliabilitySlices(entityType, entityId),
    historicalReliabilityScore: resolveHistoricalScore(entityType, entityId, overallPoints),
    recalculated,
    computedAt: new Date().toISOString(),
  };
}
