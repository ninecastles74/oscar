import type { TrendGraphPoint } from "@/types/news-platform";

const CORRECTION_DELTA_THRESHOLD = 5;

/**
 * Count score improvements between consecutive historical points (corrections over time).
 */
export function countCorrectionsInWindow(
  points: TrendGraphPoint[],
  windowDays: number,
  asOf: Date = new Date(),
): number {
  const cutoff = asOf.getTime() - windowDays * 86_400_000;
  const inWindow = points
    .filter((p) => new Date(p.recordedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  let corrections = 0;
  for (let i = 1; i < inWindow.length; i++) {
    const delta = inWindow[i].value - inWindow[i - 1].value;
    if (delta >= CORRECTION_DELTA_THRESHOLD) corrections += 1;
  }
  return corrections;
}
