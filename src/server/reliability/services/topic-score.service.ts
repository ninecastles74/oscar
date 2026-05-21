import type { ReliabilityTrendPoint, TopicReliabilityScore } from "@/types/news-platform";
import { mergeScoringConfig, validateScoringConfig } from "../config/scoring-config";
import type { TopicScoreInput } from "../types/scoring.types";
import { buildReliabilityTrend } from "./trend.service";

/**
 * Calculate topic/category reliability aggregate.
 */
export function calculateTopicScore(input: TopicScoreInput): TopicReliabilityScore {
  const config = mergeScoringConfig(input.config);
  validateScoringConfig(config);

  const history: ReliabilityTrendPoint[] = [
    ...(input.scoreHistory ?? []),
    { recordedAt: input.articleScore.computedAt, score: input.articleScore.overallScore },
  ];

  const trend = buildReliabilityTrend(history, config);

  return {
    topic: input.topic,
    overallScore: input.articleScore.overallScore,
    rollingAverage: trend.rollingAverage,
    trend,
    articlesScored: history.length,
    computedAt: new Date().toISOString(),
  };
}
