import type { CopiedReportingPair, ResearchEvidence } from "@/types/news-platform";
import { excerptSimilarity } from "./text-similarity";

const COPY_THRESHOLD = 0.72;

export function detectCopiedReporting(items: ResearchEvidence[]): {
  pairs: CopiedReportingPair[];
  items: ResearchEvidence[];
} {
  const pairs: CopiedReportingPair[] = [];
  const updated = items.map((e) => ({ ...e }));

  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const sim = excerptSimilarity(updated[i].excerpt, updated[j].excerpt);
      if (sim >= COPY_THRESHOLD) {
        pairs.push({
          sourceA: updated[i].sourceId,
          sourceB: updated[j].sourceId,
          excerptOverlap: Math.round(sim * 100),
          likelySyndicated: sim >= 0.85,
        });
        updated[i].isCopiedReporting = true;
        updated[j].isCopiedReporting = true;
        updated[i].copySimilarity = sim;
        updated[j].copySimilarity = sim;
      }
    }
  }

  return { pairs, items: updated };
}
