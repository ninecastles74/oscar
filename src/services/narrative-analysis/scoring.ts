import type { NarrativeDifference } from "@/types/news-platform";

/** 0–100: how much outlets diverge in emphasis and framing (higher = more divergence). */
export function computeNarrativeDivergenceScore(
  differences: NarrativeDifference[],
): number {
  if (!differences.length) return 0;

  let score = 0;
  for (const d of differences) {
    if (d.aspect === "narrative_alignment") {
      score = Math.min(score, 12);
      continue;
    }
    if (d.aspect === "story_emphasis") score += 38;
    else if (d.aspect === "verdict_framing") score += 42;
    else score += 22;

    const uniqueEmphasis = new Set(Object.values(d.emphasisBySource ?? {}));
    if (uniqueEmphasis.size >= 3) score += 12;
  }

  return Math.min(100, Math.round(score));
}

export function computeNarrativeAlignmentScore(divergenceScore: number): number {
  return Math.max(0, Math.min(100, 100 - divergenceScore));
}
