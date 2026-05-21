import type { Verdict } from "@/types/news-platform";
import { CLAIM_CONSENSUS_DISCLAIMERS } from "@/types/news-platform";
import { VERDICT_THRESHOLDS } from "./config";
import type { ExtractedSignals } from "./signals";
import { clampScore } from "../reliability/utils/math";

export interface ResolvedConsensus {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
}

export function resolveConsensusVerdict(
  claimText: string,
  signals: ExtractedSignals,
  hints: {
    unsupported?: boolean;
    multiModelVerdict?: Verdict;
    pipelineVerdict?: Verdict;
    hasEvidenceConflict?: boolean;
  },
): ResolvedConsensus {
  const { compositeScore, contributions } = signals;
  const byDim = Object.fromEntries(contributions.map((c) => [c.dimension, c.score])) as Record<
    string,
    number
  >;

  const evidenceQ = byDim.evidence_quality ?? 0;
  const corroboration = byDim.corroboration ?? 0;
  const contradictionSignal = byDim.contradiction_analysis ?? 50;

  let verdict: Verdict;
  let confidence: number;

  if (
    hints.unsupported ||
    evidenceQ < VERDICT_THRESHOLDS.insufficientMaxEvidence ||
    corroboration < 15
  ) {
    verdict = "insufficient_evidence";
    confidence = clampScore(Math.min(45, compositeScore * 0.6));
  } else if (
    hints.hasEvidenceConflict ||
    contradictionSignal < VERDICT_THRESHOLDS.disputedMaxContradictionSignal ||
    hints.multiModelVerdict === "disputed" ||
    hints.pipelineVerdict === "disputed"
  ) {
    verdict = "disputed";
    confidence = clampScore(48 + (100 - contradictionSignal) * 0.25);
  } else if (
    compositeScore >= VERDICT_THRESHOLDS.supportedMinComposite &&
    corroboration >= VERDICT_THRESHOLDS.supportedMinCorroboration &&
    contradictionSignal >= VERDICT_THRESHOLDS.supportedMinContradictionSignal &&
    !hints.unsupported
  ) {
    verdict = "supported";
    confidence = clampScore(compositeScore * 0.92);
  } else if (compositeScore >= VERDICT_THRESHOLDS.unclearMinComposite) {
    verdict = "unclear";
    confidence = clampScore(40 + compositeScore * 0.35);
  } else {
    verdict = "insufficient_evidence";
    confidence = clampScore(25 + compositeScore * 0.3);
  }

  if (hints.multiModelVerdict === "unclear" && verdict === "supported" && confidence < 70) {
    verdict = "unclear";
  }

  const reasoning = buildHedgedReasoning(verdict, compositeScore, contributions, hints);

  return { verdict, confidence, reasoning };
}

function buildHedgedReasoning(
  verdict: Verdict,
  composite: number,
  contributions: ExtractedSignals["contributions"],
  hints: { unsupported?: boolean; multiModelVerdict?: Verdict },
): string {
  const verdictPhrase: Record<Verdict, string> = {
    supported:
      "Available signals suggest the claim is corroborated by cited material, with dispute signals not dominant.",
    disputed:
      "Material conflicts, weak sourcing, or model disagreement outweigh corroboration in the current record.",
    unclear:
      "Signals are mixed or incomplete; the claim cannot be placed confidently in supported or disputed.",
    insufficient_evidence:
      "Retrieved evidence is too thin, neutral, or weakly weighted to support a stronger label.",
  };

  const topSignals = [...contributions]
    .sort((a, b) => b.weightedContribution - a.weightedContribution)
    .slice(0, 3)
    .map((c) => `${c.label} ${c.score}/100`)
    .join("; ");

  const parts = [
    verdictPhrase[verdict],
    `Composite consensus score ${composite}/100 (${topSignals}).`,
  ];

  if (hints.unsupported) {
    parts.push("Research flagged the claim as unsupported by approved sources.");
  }
  if (hints.multiModelVerdict && hints.multiModelVerdict !== verdict) {
    parts.push(
      `Note: multi-model layer suggested "${hints.multiModelVerdict}"; final label applies weighted arbitration.`,
    );
  }

  parts.push(CLAIM_CONSENSUS_DISCLAIMERS[0]);

  return parts.join(" ");
}
