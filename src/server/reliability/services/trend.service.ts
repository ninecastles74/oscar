import type { ReliabilityTrend, ReliabilityTrendPoint } from "@/types/news-platform";
import { mergeScoringConfig, validateScoringConfig } from "../config/scoring-config";
import type { TrendDirectionInput, TrendDirectionResult } from "../types/scoring.types";
import { clampScore } from "../utils/math";

/**
 * Calculate rolling average and trend direction from score history.
 */
export function calculateTrendDirection(input: TrendDirectionInput): TrendDirectionResult {
  const config = mergeScoringConfig(input.config);
  validateScoringConfig(config);

  const points = input.scoreHistory;
  const scores = points.map((p) => p.score);

  if (scores.length === 0) {
    return {
      direction: "stable",
      rollingAverage: 0,
      sampleSize: 0,
      windowSize: config.rollingWindow,
      recentAverage: 0,
      priorAverage: 0,
      delta: 0,
    };
  }

  const window = config.rollingWindow;
  const compare = config.trendCompareWindow;
  const rollingAverage = clampScore(
    scores.slice(-window).reduce((a, b) => a + b, 0) / Math.min(window, scores.length),
  );

  let direction: TrendDirectionResult["direction"] = "stable";
  let recentAverage = rollingAverage;
  let priorAverage = rollingAverage;
  let delta = 0;

  if (scores.length >= compare * 2) {
    const recent = scores.slice(-compare);
    const prior = scores.slice(-compare * 2, -compare);
    recentAverage = recent.reduce((a, b) => a + b, 0) / recent.length;
    priorAverage = prior.reduce((a, b) => a + b, 0) / prior.length;
    delta = recentAverage - priorAverage;
    if (delta >= config.trendDeltaThreshold) direction = "improving";
    else if (delta <= -config.trendDeltaThreshold) direction = "declining";
  }

  return {
    direction,
    rollingAverage,
    sampleSize: scores.length,
    windowSize: window,
    recentAverage: clampScore(recentAverage),
    priorAverage: clampScore(priorAverage),
    delta: Math.round(delta * 10) / 10,
  };
}

export function buildReliabilityTrend(
  scoreHistory: ReliabilityTrendPoint[],
  config?: TrendDirectionInput["config"],
): ReliabilityTrend {
  const result = calculateTrendDirection({ scoreHistory, config });
  const cfg = mergeScoringConfig(config);
  return {
    direction: result.direction,
    rollingAverage: result.rollingAverage,
    sampleSize: result.sampleSize,
    windowSize: result.windowSize,
    points: scoreHistory.slice(-cfg.rollingWindow),
  };
}

/** @deprecated Use calculateTrendDirection */
export const trendDirection = calculateTrendDirection;
export const rollingAverage = (scores: number[], window?: number) =>
  calculateTrendDirection({
    scoreHistory: scores.map((score, i) => ({
      recordedAt: new Date(Date.now() - (scores.length - i) * 86_400_000).toISOString(),
      score,
    })),
    config: window ? { rollingWindow: window } : undefined,
  }).rollingAverage;
export const buildTrend = buildReliabilityTrend;
