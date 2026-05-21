import type { ClaimResearchScores, ResearchEvidence, Verdict } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

export function calculateResearchScores(
  items: ResearchEvidence[],
  independentCount: number,
  repeatedCount: number,
  weakFlags: number,
  anonymousFlags: number,
  unsupported: boolean,
  pipelineContradictionCount = 0,
): ClaimResearchScores {
  const supporting = items.filter((e) => e.stance === "support");
  const contradicting = items.filter((e) => e.stance === "contradict");
  const primary = items.filter((e) => e.tier === "primary");

  const weightOf = (e: ResearchEvidence) => e.dynamicWeight ?? e.reliabilityWeight;
  const supportingWeighted = supporting.map(weightOf);
  const baseQuality =
    supportingWeighted.length === 0
      ? items.length === 0
        ? 0
        : items.reduce((s, e) => s + weightOf(e), 0) / items.length
      : supportingWeighted.reduce((s, w) => s + w, 0) / supportingWeighted.length;
  const evidenceQualityScore = clampScore(
    baseQuality - weakFlags * 10 - anonymousFlags * 6,
  );

  const uniqueSources = new Set(items.map((e) => e.sourceId)).size;
  const syndicated = items.filter((e) => e.isCopiedReporting).length;
  const sourceIndependenceScore = clampScore(
    uniqueSources === 0
      ? 0
      : (independentCount / Math.max(1, uniqueSources)) * 100 - (syndicated / items.length) * 30,
  );

  const corroborationScore = clampScore(
    supporting.length === 0
      ? 0
      : (independentCount / Math.max(1, supporting.length)) * 70 +
        (primary.length / Math.max(1, supporting.length)) * 30,
  );

  const contradictionScore = clampScore(
    items.length === 0
      ? pipelineContradictionCount > 0
        ? 40 + pipelineContradictionCount * 15
        : 0
      : (contradicting.length / items.length) * 100 +
        (supporting.length > 0 && contradicting.length > 0 ? 15 : 0) +
        pipelineContradictionCount * 12,
  );

  const finalConfidenceScore = clampScore(
    unsupported
      ? Math.min(25, evidenceQualityScore * 0.3)
      : evidenceQualityScore * 0.35 +
          sourceIndependenceScore * 0.25 +
          corroborationScore * 0.3 -
          contradictionScore * 0.2,
  );

  return {
    evidenceQualityScore,
    sourceIndependenceScore,
    corroborationScore,
    contradictionScore,
    finalConfidenceScore,
  };
}

export function verdictFromResearch(
  scores: ClaimResearchScores,
  unsupported: boolean,
): Verdict {
  if (unsupported) return "insufficient_evidence";
  if (scores.contradictionScore >= 55 && scores.corroborationScore < 40) return "disputed";
  if (scores.finalConfidenceScore >= 65 && scores.corroborationScore >= 50) return "supported";
  if (scores.finalConfidenceScore >= 45) return "unclear";
  return "insufficient_evidence";
}
