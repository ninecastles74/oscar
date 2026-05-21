import type { RollingWindowAverages, TrendGraphPoint, TrendRollingWindowKey } from "@/types/news-platform";
import { clampScore } from "../utils/math";

export const ROLLING_WINDOW_DAYS: Record<TrendRollingWindowKey, number> = {
  days7: 7,
  days30: 30,
  days90: 90,
  year365: 365,
};

export function averageInWindow(
  points: TrendGraphPoint[],
  windowDays: number,
  asOf: Date = new Date(),
): number | null {
  const cutoff = asOf.getTime() - windowDays * 86_400_000;
  const inWindow = points.filter((p) => new Date(p.recordedAt).getTime() >= cutoff);
  if (inWindow.length === 0) return null;
  return clampScore(inWindow.reduce((sum, p) => sum + p.value, 0) / inWindow.length);
}

export function computeRollingWindowAverages(
  points: TrendGraphPoint[],
  asOf: Date = new Date(),
): RollingWindowAverages {
  return {
    days7: averageInWindow(points, ROLLING_WINDOW_DAYS.days7, asOf),
    days30: averageInWindow(points, ROLLING_WINDOW_DAYS.days30, asOf),
    days90: averageInWindow(points, ROLLING_WINDOW_DAYS.days90, asOf),
    year365: averageInWindow(points, ROLLING_WINDOW_DAYS.year365, asOf),
  };
}

/** Bucket snapshots to one value per calendar day (last value wins). */
export function bucketPointsByDay(points: TrendGraphPoint[]): TrendGraphPoint[] {
  const byDay = new Map<string, TrendGraphPoint>();
  for (const p of points) {
    const day = p.recordedAt.slice(0, 10);
    byDay.set(day, { recordedAt: `${day}T12:00:00.000Z`, value: p.value });
  }
  return [...byDay.values()].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

export function resolveTimeRange(
  points: TrendGraphPoint[],
  from?: string,
  to?: string,
): { from: string; to: string; filtered: TrendGraphPoint[] } {
  const sorted = [...points].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const fromMs = from ? new Date(from).getTime() : null;
  const toMs = to ? new Date(to).getTime() : Date.now();
  const filtered = sorted.filter((p) => {
    const t = new Date(p.recordedAt).getTime();
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    return true;
  });
  const rangeFrom =
    from ??
    (filtered[0]?.recordedAt ?? new Date(toMs - 90 * 86_400_000).toISOString());
  const rangeTo = to ?? (filtered[filtered.length - 1]?.recordedAt ?? new Date(toMs).toISOString());
  return { from: rangeFrom, to: rangeTo, filtered };
}
