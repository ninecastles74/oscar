/** @deprecated Import from `./services/trend.service` */
export {
  calculateTrendDirection,
  buildReliabilityTrend as buildTrend,
  buildReliabilityTrend,
  calculateTrendDirection as trendDirection,
} from "./services/trend.service";

import { calculateTrendDirection } from "./services/trend.service";
import type { ReliabilityTrendPoint } from "@/types/news-platform";

export function rollingAverage(scores: number[], window = 20): number {
  const history: ReliabilityTrendPoint[] = scores.map((score, i) => ({
    recordedAt: new Date(Date.now() - (scores.length - i) * 86_400_000).toISOString(),
    score,
  }));
  return calculateTrendDirection({ scoreHistory: history, config: { rollingWindow: window } })
    .rollingAverage;
}
