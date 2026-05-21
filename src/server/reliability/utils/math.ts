export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function weightedSum(
  items: Array<{ score: number; weight: number }>,
): number {
  const sum = items.reduce((acc, i) => acc + i.score * i.weight, 0);
  return clampScore(sum);
}
