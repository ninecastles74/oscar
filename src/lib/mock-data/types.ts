// Shared mock-data domain types. These are intentionally lightweight and
// decoupled from the richer types in `src/types/news-platform.ts` so the
// mock layer can evolve without breaking the typed contract surface.

export type Verdict = "supported" | "disputed" | "unclear" | "insufficient_evidence";

export interface Source {
  id: string;
  name: string;
  domain: string;
  bias: "left" | "center-left" | "center" | "center-right" | "right";
  reliability: number; // 0-100
  approved: boolean;
}

export interface Evidence {
  id: string;
  sourceId: string;
  excerpt: string;
  /** support = supports true; contradict = false; neutral = false */
  supports: boolean;
  url: string;
  citationLabel?: string;
}

export interface Claim {
  id: string;
  text: string;
  verdict: Verdict;
  confidence: number; // 0-100
  evidence: Evidence[];
  context?: string;
  reasoning?: string;
}

export interface Story {
  id: string;
  clusterId: string;
  headline: string;
  summary: string;
  publishedAt: string;
  sourceId: string;
  url: string;
  category: string;
}

export interface Cluster {
  id: string;
  title: string;
  summary: string;
  category: string;
  storyCount: number;
  confidence: number;
  disputedClaims: number;
  missingContext: number;
  publishedAt: string;
  storyIds: string[];
  claimIds: string[];
  trendingScore: number;
}
