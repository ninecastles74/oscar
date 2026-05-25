import type {
  Category,
  HistoricalEntityType,
  HistoricalMetricType,
  ReliabilityCategoryScore,
  ReliabilityScoreBundle,
  ReliabilityTrendDirection,
  TrendGraphResponse,
} from "@/types/news-platform";
import type { ComputeReliabilityInput } from "@/server/reliability/engine";
import type { TrendAnalyticsQuery } from "@/server/reliability/analytics/trend-analytics.service";
import type { SnapshotQuery } from "@/server/reliability/historical/snapshot-store";
import type { HistoricalScoreSnapshotRecord } from "@/types/news-platform";

export interface HistoricalEntityProfile {
  entityType: HistoricalEntityType;
  entityId: string;
  label: string;
  overallScore: number;
  rollingAverage: number;
  trendDirection: ReliabilityTrendDirection;
  articlesScored: number;
}

/** Structured JSON from the Historical Reliability Engine. */
export interface HistoricalReliabilityAnalysisJson {
  historicalReliabilityScore: number;
  organizationScore: number | null;
  articleScore: number;
  authorScore: number | null;
  topicScore: number | null;
  corroborationScore: number | null;
  contradictionDetectionScore: number | null;
  sensationalismScore: number | null;
  sourceTransparencyScore: number | null;
  reportingConsistencyScore: number | null;
  trendDirection: ReliabilityTrendDirection;
  rollingAverage: number;
  sampleSize: number;
  entityProfiles: HistoricalEntityProfile[];
  categoryScores: ReliabilityCategoryScore[];
  computedAt: string;
}

export interface HistoricalReliabilityTrendJson extends TrendGraphResponse {}

export interface HistoricalReliabilitySnapshotQuery extends SnapshotQuery {}

export type {
  ComputeReliabilityInput,
  ReliabilityScoreBundle,
  TrendAnalyticsQuery,
  HistoricalScoreSnapshotRecord,
  HistoricalEntityType,
  HistoricalMetricType,
  Category,
};
