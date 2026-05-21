import type { EvidenceItem, ModelClaimVerdict, Verdict } from "@/types/news-platform";
import type { ContradictionAnalysisReport } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

export function heuristicPrimaryVerdict(
  claimText: string,
  evidence: EvidenceItem[],
  pipelineVerdict: Verdict,
  pipelineConfidence: number,
): ModelClaimVerdict {
  return {
    provider: "openai",
    model: "heuristic-primary",
    role: "primary",
    verdict: pipelineVerdict,
    confidence: pipelineConfidence,
    reasoning: `Pipeline verdict (${pipelineVerdict}) from ${evidence.length} evidence item(s).`,
  };
}

export function heuristicReviewVerdict(
  primary: ModelClaimVerdict,
  contradiction?: ContradictionAnalysisReport,
): ModelClaimVerdict {
  let confidence = primary.confidence;
  let verdict = primary.verdict;
  if (contradiction && contradiction.contradictionScore >= 50) {
    verdict = verdict === "supported" ? "disputed" : verdict;
    confidence = clampScore(confidence - contradiction.contradictionScore * 0.2);
  }
  return {
    provider: "anthropic",
    model: "heuristic-review",
    role: "review",
    verdict,
    confidence,
    reasoning: `Review layer adjusted for contradiction risk (${contradiction?.contradictionScore ?? 0}/100).`,
  };
}

export function heuristicCorroborationVerdict(
  evidence: EvidenceItem[],
  primary: ModelClaimVerdict,
): ModelClaimVerdict {
  const support = evidence.filter((e) => e.stance === "support").length;
  const contradict = evidence.filter((e) => e.stance === "contradict").length;
  let verdict = primary.verdict;
  let confidence = primary.confidence;
  if (support >= 2 && contradict === 0) {
    confidence = clampScore(confidence + 8);
  } else if (contradict >= 1) {
    verdict = "disputed";
    confidence = clampScore(confidence - 10);
  }
  return {
    provider: "google",
    model: "heuristic-corroboration",
    role: "corroboration",
    verdict,
    confidence,
    reasoning: `Corroboration scan: ${support} supporting, ${contradict} contradicting passage(s).`,
  };
}
