import { appendHistoricalSnapshot } from "../../reliability/historical/snapshot-store";
import { computeRollingWindowAverages } from "../../reliability/analytics/rolling-windows";
import {
  getArticleScores,
  getAuthorScores,
  getHistory,
  getOrganizationScores,
  listAllArticleIds,
  listAllAuthorIds,
  listAllOrganizationIds,
  listAllTopics,
} from "../../reliability/store";
import { refreshTrendSnapshotsForEntity } from "./snapshot-helpers";
import type { ScheduledJobResult } from "../types";

function trendPointsFromHistory(
  entityType: "article" | "organization" | "author" | "topic",
  entityId: string,
) {
  return getHistory(entityType, entityId).map((h) => ({
    recordedAt: h.recordedAt,
    value: h.score,
  }));
}

export function runUpdateHistoricalTrendsJob(): ScheduledJobResult {
  const startedAt = new Date().toISOString();
  const errors: ScheduledJobResult["errors"] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const entities: { type: "article" | "source" | "author" | "topic"; id: string }[] = [
    ...listAllArticleIds().map((id) => ({ type: "article" as const, id })),
    ...listAllOrganizationIds().map((id) => ({ type: "source" as const, id })),
    ...listAllAuthorIds().map((id) => ({ type: "author" as const, id })),
    ...listAllTopics().map((id) => ({ type: "topic" as const, id })),
  ];

  for (const { type, id } of entities) {
    processed += 1;
    const historyType =
      type === "source" ? "organization" : type === "article" ? "article" : type;
    const points = trendPointsFromHistory(historyType, id);
    if (points.length === 0) {
      skipped += 1;
      continue;
    }

    try {
      refreshTrendSnapshotsForEntity(type, id);
      const rolling = computeRollingWindowAverages(points);
      const recordedAt = new Date().toISOString();

      for (const [window, value] of Object.entries(rolling) as [string, number | null][]) {
        if (value === null) continue;
        appendHistoricalSnapshot({
          entityType: type,
          entityId: id,
          metricType: "rolling_average",
          metricKey: window,
          scoreValue: value,
          sampleSize: points.length,
          recordedAt,
          metadata: { window },
        });
      }

      if (type === "article") {
        const versions = getArticleScores(id);
        const latest = versions[versions.length - 1];
        if (latest?.avgClaimConfidence !== undefined) {
          appendHistoricalSnapshot({
            entityType: "article",
            entityId: id,
            metricType: "confidence",
            scoreValue: latest.avgClaimConfidence,
            recordedAt,
          });
        }
      }

      if (type === "source") {
        const org = getOrganizationScores(id);
        const last = org[org.length - 1];
        if (last) {
          appendHistoricalSnapshot({
            entityType: "source",
            entityId: id,
            metricType: "corroboration_rate",
            scoreValue: last.corroborationConfidence,
            recordedAt,
          });
        }
      }

      if (type === "author") {
        const auth = getAuthorScores(id);
        const last = auth[auth.length - 1];
        if (last) {
          appendHistoricalSnapshot({
            entityType: "author",
            entityId: id,
            metricType: "reporting_consistency",
            scoreValue: last.reportingConsistency,
            recordedAt,
          });
        }
      }

      updated += 1;
    } catch (err) {
      errors.push({
        entityId: id,
        message: err instanceof Error ? err.message : "Trend update failed",
      });
    }
  }

  return {
    jobId: "update_historical_trends",
    startedAt,
    completedAt: new Date().toISOString(),
    success: errors.length === 0,
    processed,
    updated,
    skipped,
    errors,
    details: { entityCount: entities.length },
  };
}
