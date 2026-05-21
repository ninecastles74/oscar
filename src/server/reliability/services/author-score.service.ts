import type { AuthorReliabilityScore, ReliabilityTrendPoint } from "@/types/news-platform";
import { mergeScoringConfig, validateScoringConfig } from "../config/scoring-config";
import type { AuthorScoreInput } from "../types/scoring.types";
import { clampScore } from "../utils/math";
import { buildReliabilityTrend } from "./trend.service";

/**
 * Calculate author reliability from article score + history.
 */
export function calculateAuthorScore(input: AuthorScoreInput): AuthorReliabilityScore {
  const config = mergeScoringConfig(input.config);
  validateScoringConfig(config);

  const history: ReliabilityTrendPoint[] = [
    ...(input.scoreHistory ?? []),
    { recordedAt: input.articleScore.computedAt, score: input.articleScore.overallScore },
  ];

  const trend = buildReliabilityTrend(history, config);
  const cat = Object.fromEntries(input.articleScore.categories.map((c) => [c.id, c.score]));

  return {
    authorId: input.authorId,
    displayName: input.displayName,
    overallScore: trend.rollingAverage,
    rollingAverage: trend.rollingAverage,
    trend,
    reportingConsistency: clampScore(
      (cat.context_completeness ?? 50) * 0.5 + (cat.evidence_support ?? 50) * 0.5,
    ),
    corroborationConfidence: cat.cross_source_corroboration ?? 50,
    articlesScored: history.length,
    topicScores: [],
    computedAt: new Date().toISOString(),
  };
}
