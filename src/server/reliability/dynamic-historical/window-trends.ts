import type { ReliabilityTrendDirection, TrendGraphPoint } from "@/types/news-platform";
import {
  averageInWindow,
  computeRollingWindowAverages,
  ROLLING_WINDOW_DAYS,
} from "../analytics/rolling-windows";
import { calculateTrendDirection } from "../services/trend.service";
import { clampScore } from "../utils/math";
import { countCorrectionsInWindow } from "./corrections";
import type { ReliabilityWindowTrend } from "./types";

function trendDirectionForWindow(
  points: TrendGraphPoint[],
  windowDays: number,
  asOf: Date,
): ReliabilityTrendDirection {
  const cutoff = asOf.getTime() - windowDays * 86_400_000;
  const inWindow = points
    .filter((p) => new Date(p.recordedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (inWindow.length < 2) return "stable";

  const compare = Math.max(2, Math.floor(inWindow.length / 2));
  const result = calculateTrendDirection({
    scoreHistory: inWindow.map((p) => ({ recordedAt: p.recordedAt, score: p.value })),
    config: {
      rollingWindow: Math.min(inWindow.length, 20),
      trendCompareWindow: compare,
    },
  });
  return result.direction;
}

export function buildReliabilityWindowTrend(
  overallPoints: TrendGraphPoint[],
  contradictionPoints: TrendGraphPoint[],
  evidencePoints: TrendGraphPoint[],
  windowDays: 7 | 30 | 90 | 365,
  asOf: Date,
): ReliabilityWindowTrend {
  const cutoff = asOf.getTime() - windowDays * 86_400_000;
  const inWindow = overallPoints.filter((p) => new Date(p.recordedAt).getTime() >= cutoff);
  const rollingAverage = averageInWindow(overallPoints, windowDays, asOf);
  const current = inWindow.length > 0 ? inWindow[inWindow.length - 1].value : null;
  const delta =
    current !== null && rollingAverage !== null
      ? Math.round((current - rollingAverage) * 10) / 10
      : null;

  const contradictionAvg = averageInWindow(contradictionPoints, windowDays, asOf);
  const contradictionFrequency =
    contradictionAvg !== null ? clampScore(100 - contradictionAvg) : null;

  return {
    windowDays,
    rollingAverage,
    direction: trendDirectionForWindow(overallPoints, windowDays, asOf),
    delta,
    sampleSize: inWindow.length,
    overallScore: current,
    contradictionFrequency,
    evidenceQualityAverage: averageInWindow(evidencePoints, windowDays, asOf),
    correctionCount: countCorrectionsInWindow(overallPoints, windowDays, asOf),
    points: inWindow,
  };
}

export function buildConfidenceTrend(
  confidencePoints: TrendGraphPoint[],
  asOf: Date,
): import("./types").ConfidenceTrend {
  const sorted = [...confidencePoints].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const rolling = computeRollingWindowAverages(sorted, asOf);
  const trend = calculateTrendDirection({
    scoreHistory: sorted.map((p) => ({ recordedAt: p.recordedAt, score: p.value })),
  });
  const currentValue = sorted.length > 0 ? sorted[sorted.length - 1].value : null;
  const delta30d =
    rolling.days30 !== null && currentValue !== null
      ? Math.round((currentValue - rolling.days30) * 10) / 10
      : null;

  return {
    direction: trend.direction,
    currentValue,
    rollingAverage: trend.rollingAverage,
    sevenDayAverage: rolling.days7,
    thirtyDayAverage: rolling.days30,
    delta30d,
    sampleSize: sorted.length,
    points: sorted.slice(-Math.max(ROLLING_WINDOW_DAYS.year365, 30)),
  };
}
