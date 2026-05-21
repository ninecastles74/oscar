import type {
  ArticleReliabilityScore,
  AuthorReliabilityScore,
  OrganizationReliabilityScore,
  TopicReliabilityScore,
} from "@/types/news-platform";
import { appendHistoricalSnapshot } from "../../reliability/historical/snapshot-store";
import { buildReliabilityTrend } from "../../reliability/services/trend.service";
import { getHistory } from "../../reliability/store";

export function recordHistoricalSnapshots(
  entity:
    | OrganizationReliabilityScore
    | AuthorReliabilityScore
    | TopicReliabilityScore,
  article: ArticleReliabilityScore,
  entityType: "source" | "author" | "topic",
): void {
  const entityId =
    entityType === "source"
      ? (entity as OrganizationReliabilityScore).organizationId
      : entityType === "author"
        ? (entity as AuthorReliabilityScore).authorId
        : (entity as TopicReliabilityScore).topic;

  appendHistoricalSnapshot({
    entityType,
    entityId,
    metricType: "overall_score",
    scoreValue: entity.overallScore,
    sampleSize: "articlesScored" in entity ? entity.articlesScored : 1,
    topic: article.topic,
    articleId: article.articleId,
    reportId: article.reportId,
    recordedAt: entity.computedAt,
  });
  appendHistoricalSnapshot({
    entityType,
    entityId,
    metricType: "rolling_average",
    scoreValue: entity.rollingAverage,
    recordedAt: entity.computedAt,
    topic: article.topic,
  });
}

/** Append trend + rolling metric snapshots for all entities with history. */
export function refreshTrendSnapshotsForEntity(
  entityType: "article" | "source" | "author" | "topic",
  entityId: string,
): number {
  const historyType =
    entityType === "source"
      ? ("organization" as const)
      : entityType === "article"
        ? ("article" as const)
        : entityType === "author"
          ? ("author" as const)
          : ("topic" as const);

  const points = getHistory(historyType, entityId).map((h) => ({
    recordedAt: h.recordedAt,
    score: h.score,
  }));
  if (points.length === 0) return 0;

  const trend = buildReliabilityTrend(points);
  const recordedAt = new Date().toISOString();

  appendHistoricalSnapshot({
    entityType,
    entityId,
    metricType: "rolling_average",
    scoreValue: trend.rollingAverage,
    sampleSize: trend.sampleSize,
    recordedAt,
    metadata: { direction: trend.direction, windowSize: trend.windowSize },
  });

  return 1;
}
