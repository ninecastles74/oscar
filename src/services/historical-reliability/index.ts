export type {
  HistoricalReliabilityAnalysisJson,
  HistoricalReliabilityTrendJson,
  HistoricalReliabilitySnapshotQuery,
  HistoricalEntityProfile,
  ComputeReliabilityInput,
  ReliabilityScoreBundle,
  TrendAnalyticsQuery,
  HistoricalScoreSnapshotRecord,
  HistoricalEntityType,
  HistoricalMetricType,
  Category,
} from "./types";

export {
  analyzeHistoricalReliability,
  computeHistoricalReliability,
  recalculateHistoricalReliability,
  getHistoricalReliabilityByArticleId,
  queryHistoricalReliabilityTrend,
  queryHistoricalReliabilitySnapshots,
  getSourceReliabilityTrend,
  getAuthorReliabilityTrend,
  getTopicReliabilityTrend,
  getContradictionTrend,
  getEntityTrendDashboard,
} from "./engine";

export {
  computeHistoricalReliabilityScore,
  resolvePrimaryTrendDirection,
  resolveRollingAverage,
} from "./scoring";

export {
  computeAndStoreReliabilityScores,
  getReliabilityBundleByArticleId,
  recalculateReliabilityScores,
} from "@/server/reliability/engine";

export {
  buildTrendGraphResponse,
  type TrendAnalyticsQuery,
} from "@/server/reliability/analytics/trend-analytics.service";

export {
  appendHistoricalSnapshot,
  appendHistoricalSnapshots,
  queryHistoricalSnapshots,
  recordHistoricalSnapshotsFromResult,
} from "@/server/reliability/historical";

export {
  runDynamicHistoricalReliability,
  type DynamicHistoricalReliabilityJson,
} from "@/services/dynamic-historical-reliability";
