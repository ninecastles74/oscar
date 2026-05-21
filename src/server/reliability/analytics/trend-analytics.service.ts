import type {
  HistoricalEntityType,
  HistoricalMetricType,
  ReliabilityTrendDirection,
  TrendGraphPoint,
  TrendGraphResponse,
  TrendGraphSeries,
} from "@/types/news-platform";
import { RELIABILITY_SCORING_DISCLAIMER } from "@/types/news-platform";
import type { Category } from "@/types/news-platform";
import { backfillSnapshotsFromHistory } from "../historical/backfill-from-history";
import { queryHistoricalSnapshots } from "../historical/snapshot-store";
import { calculateTrendDirection } from "../services/trend.service";
import { METRIC_LABELS } from "./metric-labels";
import {
  bucketPointsByDay,
  computeRollingWindowAverages,
  resolveTimeRange,
} from "./rolling-windows";

export interface TrendAnalyticsQuery {
  entityType: HistoricalEntityType;
  entityId: string;
  entityLabel?: string;
  metricTypes: HistoricalMetricType[];
  topic?: Category;
  from?: string;
  to?: string;
  granularity?: "point" | "day";
  asOf?: Date;
}

function snapshotsToPoints(
  entityType: HistoricalEntityType,
  entityId: string,
  metricType: HistoricalMetricType,
  topic?: Category,
  from?: string,
  to?: string,
): TrendGraphPoint[] {
  return queryHistoricalSnapshots({
    entityType,
    entityId,
    metricType,
    topic,
    from,
    to,
  }).map((s) => ({ recordedAt: s.recordedAt, value: s.scoreValue }));
}

function buildSeries(
  entityType: HistoricalEntityType,
  entityId: string,
  metricType: HistoricalMetricType,
  query: TrendAnalyticsQuery,
): TrendGraphSeries {
  const raw = snapshotsToPoints(
    entityType,
    entityId,
    metricType,
    query.topic,
    query.from,
    query.to,
  );
  const { filtered } = resolveTimeRange(raw, query.from, query.to);
  const points =
    query.granularity === "day" ? bucketPointsByDay(filtered) : filtered;
  const asOf = query.asOf ?? new Date();
  return {
    metricType,
    label: METRIC_LABELS[metricType],
    points,
    rollingAverages: computeRollingWindowAverages(points, asOf),
  };
}

function summarizeSeries(
  series: TrendGraphSeries[],
  asOf: Date,
): TrendGraphResponse["summary"] {
  const primary = series[0];
  const points = primary?.points ?? [];
  const rollingAverages = primary
    ? primary.rollingAverages
    : computeRollingWindowAverages([], asOf);
  const trend = calculateTrendDirection({
    scoreHistory: points.map((p) => ({ recordedAt: p.recordedAt, score: p.value })),
  });
  const currentValue = points.length > 0 ? points[points.length - 1].value : null;
  const delta30d =
    rollingAverages.days30 !== null && currentValue !== null
      ? Math.round((currentValue - rollingAverages.days30) * 10) / 10
      : null;

  return {
    currentValue,
    direction: trend.direction as ReliabilityTrendDirection,
    sampleSize: points.length,
    delta30d,
    rollingAverages,
  };
}

export function buildTrendGraphResponse(query: TrendAnalyticsQuery): TrendGraphResponse {
  backfillSnapshotsFromHistory();

  const series = query.metricTypes.map((metricType) =>
    buildSeries(query.entityType, query.entityId, metricType, query),
  );
  const allPoints = series.flatMap((s) => s.points);
  const { from, to } = resolveTimeRange(allPoints, query.from, query.to);
  const asOf = query.asOf ?? new Date();

  return {
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    entityType: query.entityType,
    entityId: query.entityId,
    entityLabel: query.entityLabel,
    topic: query.topic,
    timeRange: { from, to },
    granularity: query.granularity ?? "day",
    series,
    summary: summarizeSeries(series, asOf),
    computedAt: new Date().toISOString(),
  };
}

/** Source (organization) overall reliability over time. */
export function getSourceReliabilityTrend(
  organizationId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  return buildTrendGraphResponse({
    entityType: "source",
    entityId: organizationId,
    metricTypes: ["overall_score", "rolling_average"],
    ...options,
  });
}

/** Author overall reliability over time. */
export function getAuthorReliabilityTrend(
  authorId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  return buildTrendGraphResponse({
    entityType: "author",
    entityId: authorId,
    metricTypes: ["overall_score", "rolling_average"],
    ...options,
  });
}

/** Topic aggregate reliability over time. */
export function getTopicReliabilityTrend(
  topic: Category,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  return buildTrendGraphResponse({
    entityType: "topic",
    entityId: topic,
    metricTypes: ["overall_score", "rolling_average"],
    topic,
    ...options,
  });
}

/** Contradiction frequency and detection scores over time. */
export function getContradictionTrend(
  entityType: HistoricalEntityType,
  entityId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  const metrics: HistoricalMetricType[] =
    entityType === "article"
      ? ["contradiction_count", "contradiction_detection"]
      : ["contradiction_detection"];
  return buildTrendGraphResponse({
    entityType,
    entityId,
    metricTypes: metrics,
    ...options,
  });
}

/** Sensationalism category scores over time (lower sensationalism score = more sensational). */
export function getSensationalismTrend(
  entityType: HistoricalEntityType,
  entityId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  return buildTrendGraphResponse({
    entityType,
    entityId,
    metricTypes: ["sensationalism"],
    ...options,
  });
}

/** Claim confidence over time. */
export function getConfidenceTrend(
  entityType: HistoricalEntityType,
  entityId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  const metrics: HistoricalMetricType[] =
    entityType === "article" ? ["confidence", "evidence_support"] : ["evidence_support"];
  return buildTrendGraphResponse({
    entityType,
    entityId,
    metricTypes: metrics,
    ...options,
  });
}

/** Multi-metric dashboard for an entity. */
export function getEntityTrendDashboard(
  entityType: HistoricalEntityType,
  entityId: string,
  options?: Omit<TrendAnalyticsQuery, "entityType" | "entityId" | "metricTypes">,
): TrendGraphResponse {
  const metrics: HistoricalMetricType[] = [
    "overall_score",
    "confidence",
    "contradiction_detection",
    "sensationalism",
    "corroboration_rate",
  ];
  return buildTrendGraphResponse({
    entityType,
    entityId,
    metricTypes: metrics,
    ...options,
  });
}
