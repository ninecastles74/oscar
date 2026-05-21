export {
  calculateArticleScore,
  calculateSourceScore,
  calculateAuthorScore,
  calculateTopicScore,
  calculateTrendDirection,
  buildReliabilityTrend,
  recalculateScores,
} from "./services";
export {
  mergeScoringConfig,
  validateScoringConfig,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
} from "./config/scoring-config";
export type {
  ScoringSignals,
  ArticleScoreInput,
  ArticleScoreResult,
  SourceScoreInput,
  AuthorScoreInput,
  TopicScoreInput,
  TrendDirectionInput,
  TrendDirectionResult,
  RecalculateScoresInput,
  RecalculateScoresResult,
  AppliedPenalties,
} from "./types/scoring.types";
export { toScoringSignals } from "./adapters/scoring-signals";
export {
  computeAndStoreReliabilityScores,
  persistRecalculatedScores,
  getReliabilityBundleByArticleId,
  recalculateReliabilityScores,
  type ComputeReliabilityInput,
  type PersistScoresContext,
} from "./engine";
export {
  enqueueEvidenceRecalculation,
  peekEvidenceRecalculationQueue,
  getEvidenceRecalculationQueueSize,
} from "./evidence-queue";
export {
  calculateTopicSourceReliability,
  updateTopicSourceReliabilityForArticle,
  getAllTopicSourceReliabilityForOrg,
  getLatestTopicSourceReliability,
} from "./topics";
export { getReliabilityScores, recalculateReliability } from "./functions";
export {
  appendHistoricalSnapshot,
  queryHistoricalSnapshots,
  recordHistoricalSnapshotsFromResult,
} from "./historical";
export {
  buildTrendGraphResponse,
  getSourceReliabilityTrend,
  getAuthorReliabilityTrend,
  getTopicReliabilityTrend,
  getContradictionTrend,
  getSensationalismTrend,
  getConfidenceTrend,
  getEntityTrendDashboard,
  computeRollingWindowAverages,
  ROLLING_WINDOW_DAYS,
} from "./analytics";
export {
  buildScoreExplainability,
  buildFullExplainabilityBundle,
  getScoreExplainability,
  getAnalysisExplainability,
} from "./explainability";
export {
  getSourceReliabilityTrendGraph,
  getAuthorReliabilityTrendGraph,
  getTopicReliabilityTrendGraph,
  getContradictionTrendGraph,
  getSensationalismTrendGraph,
  getConfidenceTrendGraph,
  getEntityTrendGraph,
} from "./analytics/functions";
