import type { ReliabilityScoreBundle, ReliabilityTrendDirection } from "@/types/news-platform";
import {
  computeHistoricalReliabilityScore,
} from "@/server/reliability/historical-score";
import { clampScore } from "@/server/reliability/utils/math";

export { computeHistoricalReliabilityScore };

export function resolvePrimaryTrendDirection(
  bundle: ReliabilityScoreBundle,
): ReliabilityTrendDirection {
  return bundle.organization?.trend?.direction ?? bundle.trends.article.direction ?? "stable";
}

export function resolveRollingAverage(bundle: ReliabilityScoreBundle): number {
  return clampScore(
    bundle.organization?.rollingAverage ??
      bundle.trends.organization?.rollingAverage ??
      bundle.trends.article.rollingAverage,
  );
}
