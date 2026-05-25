import { buildContradictionAnalysis } from "@/server/contradiction";
import type { EvidenceItem } from "@/types/news-platform";
import type { PeerArticleSlice } from "@/server/contradiction/types";
import {
  computeContextCompletenessScore,
  computeOmissionScore,
  contradictionScoreFromReport,
  framingIntensityScoreFromReport,
} from "./omission-scoring";
import type { ContradictionOmissionAnalysisJson } from "./types";

export interface ContradictionOmissionInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
  peerArticles?: PeerArticleSlice[];
}

/**
 * Contradiction & Omission Analysis Engine
 *
 * Compares claims to evidence and peer articles; detects contradictions, omitted
 * context, timeline issues, unsupported causal claims and statistics, and
 * emotionally exaggerated framing. Returns structured JSON only.
 */
export function analyzeContradictionAndOmission(
  input: ContradictionOmissionInput,
): ContradictionOmissionAnalysisJson {
  const report = buildContradictionAnalysis({
    claim: { id: input.claimId, text: input.claimText },
    evidence: input.evidence,
    peerArticles: input.peerArticles,
  });

  const omissionScore = computeOmissionScore(report);

  return {
    claimId: input.claimId,
    contradictionScore: contradictionScoreFromReport(report),
    omissionScore,
    contextCompletenessScore: computeContextCompletenessScore(report, omissionScore),
    framingIntensityScore: framingIntensityScoreFromReport(report),
  };
}

export function analyzeContradictionAndOmissionBatch(
  inputs: ContradictionOmissionInput[],
): ContradictionOmissionAnalysisJson[] {
  return inputs.map(analyzeContradictionAndOmission);
}
