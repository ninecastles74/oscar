import type { Cluster } from "./types";
import { CATEGORIES, CLAIMS_POOL, HEADLINES, pick, rng } from "./seed";

export const CLUSTERS: Cluster[] = Array.from({ length: 30 }, (_, i) => {
  const r = rng(i + 1);
  const storyCount = 3 + Math.floor(r() * 10);
  const confidence = 50 + Math.floor(r() * 50);
  return {
    id: `c${i + 1}`,
    title: HEADLINES[i % HEADLINES.length],
    summary:
      "Multiple outlets are reporting on this developing story. Our AI has cross-referenced claims across sources to surface points of agreement, dispute, and missing context.",
    category: CATEGORIES[i % CATEGORIES.length],
    storyCount,
    confidence,
    disputedClaims: Math.floor(r() * 4),
    missingContext: Math.floor(r() * 3),
    publishedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    storyIds: Array.from({ length: storyCount }, (_, j) => `c${i + 1}-s${j + 1}`),
    claimIds: pick(CLAIMS_POOL, 4 + (i % 3), i).map((_, j) => `c${i + 1}-cl${j + 1}`),
    trendingScore: Math.floor(r() * 100),
  };
});

export function clusterById(id: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.id === id);
}
