import type { ResearchEvidence } from "@/types/news-platform";

export function classifyIndependence(
  items: ResearchEvidence[],
  copiedPairs: { sourceA: string; sourceB: string; likelySyndicated: boolean }[],
): {
  items: ResearchEvidence[];
  independentCount: number;
  repeatedCount: number;
} {
  const syndicatedSources = new Set<string>();
  for (const p of copiedPairs) {
    if (p.likelySyndicated) {
      syndicatedSources.add(p.sourceA);
      syndicatedSources.add(p.sourceB);
    }
  }

  const supporting = items.filter((e) => e.stance === "support");
  const independentRoots = new Set<string>();

  const updated = items.map((e) => {
    const inSyndicate = syndicatedSources.has(e.sourceId);
    const hasUniqueExcerpt =
      !inSyndicate &&
      supporting.some(
        (o) =>
          o.sourceId !== e.sourceId &&
          o.excerpt.slice(0, 80) !== e.excerpt.slice(0, 80),
      );
    const isIndependent =
      e.stance === "support" &&
      e.tier === "primary" &&
      !inSyndicate &&
      (hasUniqueExcerpt || supporting.filter((s) => s.sourceId === e.sourceId).length === 1);

    if (isIndependent) independentRoots.add(e.sourceId);

    return {
      ...e,
      isIndependentConfirmation: isIndependent,
    };
  });

  const independentCount = independentRoots.size;
  const repeatedCount = supporting.length - independentCount;

  return { items: updated, independentCount, repeatedCount: Math.max(0, repeatedCount) };
}
