import type { OrganizationReliabilityScore, ReliabilityTrendPoint } from "@/types/news-platform";
import { mergeScoringConfig, validateScoringConfig } from "../config/scoring-config";
import type { SourceScoreInput } from "../types/scoring.types";
import { clampScore } from "../utils/math";
import { buildReliabilityTrend } from "./trend.service";

/**
 * Calculate news-organization reliability from article score + history.
 */
export function calculateSourceScore(input: SourceScoreInput): OrganizationReliabilityScore {
  const config = mergeScoringConfig(input.config);
  validateScoringConfig(config);

  const history: ReliabilityTrendPoint[] = [
    ...(input.scoreHistory ?? []),
    { recordedAt: input.articleScore.computedAt, score: input.articleScore.overallScore },
  ];

  const trend = buildReliabilityTrend(history, config);
  const cat = Object.fromEntries(input.articleScore.categories.map((c) => [c.id, c.score]));

  const reportingConsistency = clampScore(
    (cat.context_completeness ?? 50) * 0.5 + (cat.cross_source_corroboration ?? 50) * 0.5,
  );

  return {
    organizationId: input.organizationId,
    name: input.name,
    domain: input.domain,
    overallScore: trend.rollingAverage,
    rollingAverage: trend.rollingAverage,
    trend,
    reportingConsistency,
    corroborationConfidence: cat.cross_source_corroboration ?? 50,
    sourceTransparency: cat.source_transparency ?? 50,
    contradictionFrequency: clampScore(100 - (cat.contradiction_detection ?? 50)),
    topicScores: [],
    articlesScored: history.length,
    computedAt: new Date().toISOString(),
  };
}
