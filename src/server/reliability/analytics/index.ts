export {
  ROLLING_WINDOW_DAYS,
  averageInWindow,
  computeRollingWindowAverages,
  bucketPointsByDay,
  resolveTimeRange,
} from "./rolling-windows";
export { METRIC_LABELS } from "./metric-labels";
export {
  buildTrendGraphResponse,
  getSourceReliabilityTrend,
  getAuthorReliabilityTrend,
  getTopicReliabilityTrend,
  getContradictionTrend,
  getSensationalismTrend,
  getConfidenceTrend,
  getEntityTrendDashboard,
  type TrendAnalyticsQuery,
} from "./trend-analytics.service";
export {
  getSourceReliabilityTrendGraph,
  getAuthorReliabilityTrendGraph,
  getTopicReliabilityTrendGraph,
  getContradictionTrendGraph,
  getSensationalismTrendGraph,
  getConfidenceTrendGraph,
  getEntityTrendGraph,
} from "./functions";
