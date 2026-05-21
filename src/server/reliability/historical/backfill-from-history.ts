import type { HistoricalEntityType } from "@/types/news-platform";
import { appendHistoricalSnapshot, getSnapshotCount } from "./snapshot-store";
import { getHistory } from "../store";

const ENTITY_MAP: Record<
  "article" | "organization" | "author" | "topic",
  HistoricalEntityType
> = {
  article: "article",
  organization: "source",
  author: "author",
  topic: "topic",
};

/** Seed snapshots from legacy history entries when snapshot store is empty. */
export function backfillSnapshotsFromHistory(): number {
  if (getSnapshotCount() > 0) return 0;

  const entries = getHistory();
  for (const entry of entries) {
    appendHistoricalSnapshot({
      entityType: ENTITY_MAP[entry.entityType],
      entityId: entry.entityId,
      metricType: "overall_score",
      scoreValue: entry.score,
      topic: entry.topic,
      reportId: entry.reportId,
      recordedAt: entry.recordedAt,
    });
  }
  return entries.length;
}
