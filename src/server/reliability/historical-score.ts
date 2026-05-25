import type { ReliabilityCategoryId, ReliabilityScoreBundle } from "@/types/news-platform";
import { clampScore } from "./utils/math";

function catScore(
  bundle: ReliabilityScoreBundle,
  id: ReliabilityCategoryId,
): number | undefined {
  return bundle.article.categories.find((c) => c.id === id)?.score;
}

function averageDefined(values: (number | undefined)[]): number {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return 50;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeHistoricalReliabilityScore(bundle: ReliabilityScoreBundle): number {
  return clampScore(
    averageDefined([
      bundle.organization?.overallScore,
      bundle.organization?.corroborationConfidence,
      catScore(bundle, "cross_source_corroboration"),
      catScore(bundle, "contradiction_detection"),
      bundle.article.overallScore,
    ]),
  );
}
