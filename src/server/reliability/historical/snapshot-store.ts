import type {
  Category,
  HistoricalEntityType,
  HistoricalMetricType,
  HistoricalScoreSnapshotRecord,
} from "@/types/news-platform";

const snapshots: HistoricalScoreSnapshotRecord[] = [];
const MAX_SNAPSHOTS = 50_000;

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `hss_${Date.now()}_${idCounter}`;
}

export interface AppendSnapshotInput {
  entityType: HistoricalEntityType;
  entityId: string;
  metricType: HistoricalMetricType;
  scoreValue: number;
  metricKey?: string;
  sampleSize?: number;
  topic?: Category;
  reportId?: string;
  articleId?: string;
  metadata?: Record<string, unknown>;
  recordedAt?: string;
}

export function appendHistoricalSnapshot(input: AppendSnapshotInput): HistoricalScoreSnapshotRecord {
  const record: HistoricalScoreSnapshotRecord = {
    id: nextId(),
    entityType: input.entityType,
    entityId: input.entityId,
    metricType: input.metricType,
    metricKey: input.metricKey,
    scoreValue: input.scoreValue,
    sampleSize: input.sampleSize,
    topic: input.topic,
    reportId: input.reportId,
    articleId: input.articleId,
    metadata: input.metadata,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
  snapshots.push(record);
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  }
  return record;
}

export function appendHistoricalSnapshots(inputs: AppendSnapshotInput[]): HistoricalScoreSnapshotRecord[] {
  return inputs.map(appendHistoricalSnapshot);
}

export interface SnapshotQuery {
  entityType?: HistoricalEntityType;
  entityId?: string;
  metricType?: HistoricalMetricType;
  metricTypes?: HistoricalMetricType[];
  topic?: Category;
  from?: string;
  to?: string;
  limit?: number;
}

export function queryHistoricalSnapshots(query: SnapshotQuery = {}): HistoricalScoreSnapshotRecord[] {
  const fromMs = query.from ? new Date(query.from).getTime() : null;
  const toMs = query.to ? new Date(query.to).getTime() : null;
  const metricSet = query.metricTypes
    ? new Set(query.metricTypes)
    : query.metricType
      ? new Set([query.metricType])
      : null;

  let results = snapshots.filter((s) => {
    if (query.entityType && s.entityType !== query.entityType) return false;
    if (query.entityId && s.entityId !== query.entityId) return false;
    if (query.topic && s.topic !== query.topic) return false;
    if (metricSet && !metricSet.has(s.metricType)) return false;
    const t = new Date(s.recordedAt).getTime();
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    return true;
  });

  results.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (query.limit !== undefined && query.limit > 0) {
    results = results.slice(-query.limit);
  }

  return results;
}

export function getSnapshotCount(): number {
  return snapshots.length;
}

export function clearHistoricalSnapshots(): void {
  snapshots.length = 0;
}
