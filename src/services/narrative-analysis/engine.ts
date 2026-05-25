import { alignClaimsAcrossArticles } from "@/server/consensus/claim-alignment";
import { analyzeNarrativeDifferences } from "@/server/consensus/narrative-analysis";
import {
  computeNarrativeAlignmentScore,
  computeNarrativeDivergenceScore,
} from "./scoring";
import type { NarrativeAnalysisInput, NarrativeAnalysisJson } from "./types";

/**
 * Narrative Analysis Engine — compares how outlets frame the same event
 * (headline emphasis, lead claims, verdict patterns). Returns structured JSON only.
 */
export function runNarrativeAnalysis(input: NarrativeAnalysisInput): NarrativeAnalysisJson {
  const articles = input.articles;
  const alignedGroups = alignClaimsAcrossArticles(articles);
  const narrativeDifferences = analyzeNarrativeDifferences(articles, alignedGroups);

  const divergenceScore = computeNarrativeDivergenceScore(narrativeDifferences);
  const sourceCount = new Set(articles.map((a) => a.sourceId)).size;

  return {
    narrativeDifferences,
    narrativeDivergenceScore: divergenceScore,
    narrativeAlignmentScore: computeNarrativeAlignmentScore(divergenceScore),
    sourceCount,
    articleCount: articles.length,
    aspectsDetected: narrativeDifferences.map((d) => d.aspect),
    computedAt: new Date().toISOString(),
  };
}

export function runNarrativeAnalysisBatch(
  inputs: NarrativeAnalysisInput[],
): NarrativeAnalysisJson[] {
  return inputs.map(runNarrativeAnalysis);
}
