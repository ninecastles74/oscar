import type { NarrativeDifference } from "@/types/news-platform";
import type { AnalyzedArticleBundle } from "@/server/consensus/types";

export interface NarrativeAnalysisInput {
  articles: AnalyzedArticleBundle[];
}

/** Structured JSON from the Narrative Analysis service. */
export interface NarrativeAnalysisJson {
  narrativeDifferences: NarrativeDifference[];
  narrativeDivergenceScore: number;
  narrativeAlignmentScore: number;
  sourceCount: number;
  articleCount: number;
  aspectsDetected: string[];
  computedAt: string;
}

export type { AnalyzedArticleBundle, NarrativeDifference };
