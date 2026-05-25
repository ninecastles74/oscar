import {
  buildClaimConsensus,
  buildClaimConsensusBatch,
} from "@/server/consensus-engine";
import type {
  ClaimConsensusBatchInput,
  ClaimConsensusInput,
  ClaimConsensusSummaryJson,
} from "./types";
import type { ClaimConsensusBatchJson, ClaimConsensusJson } from "./types";

/**
 * Claim Consensus Engine (service facade)
 *
 * Combines evidence quality, AI reasoning, source independence, contradiction
 * analysis, corroboration, and historical reliability into epistemic verdicts.
 * Returns structured JSON only — not objective truth labels.
 */
export function runClaimConsensus(input: ClaimConsensusInput): ClaimConsensusJson {
  return buildClaimConsensus(input.claim, input.reliability);
}

export function runClaimConsensusBatch(
  input: ClaimConsensusBatchInput,
): ClaimConsensusBatchJson {
  return buildClaimConsensusBatch(input.claims, input.articleId, input.reliability);
}

/** Compact JSON summary for UI lists. */
export function summarizeClaimConsensus(report: ClaimConsensusJson): ClaimConsensusSummaryJson {
  return {
    claimId: report.claimId,
    verdict: report.verdict,
    confidence: report.confidence,
    compositeScore: report.compositeScore,
    signalCount: report.signals.length,
  };
}
