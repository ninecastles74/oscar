import type { Story } from "./types";
import { CLUSTERS } from "./clusters";
import { SOURCES } from "./sources";

export const STORIES: Story[] = CLUSTERS.flatMap((c, ci) =>
  c.storyIds.map((sid, si) => ({
    id: sid,
    clusterId: c.id,
    headline: c.title,
    summary:
      "Coverage from this outlet emphasizes context and quotes specific officials. Read the full analysis to compare framing across sources.",
    publishedAt: new Date(Date.now() - (ci * 10 + si) * 1800_000).toISOString(),
    sourceId: SOURCES[(ci + si) % SOURCES.length].id,
    url: `https://${SOURCES[(ci + si) % SOURCES.length].domain}/article/${sid}`,
    category: c.category,
    imageUrl: c.imageUrl
      ? `https://picsum.photos/seed/${sid}/160/120`
      : undefined,
  })),
);

export function storiesForCluster(id: string): Story[] {
  return STORIES.filter((s) => s.clusterId === id);
}
