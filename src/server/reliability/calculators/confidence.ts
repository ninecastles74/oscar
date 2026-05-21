import type { Claim } from "@/types/news-platform";
import { clampScore } from "../utils/math";

export interface ConfidenceMetrics {
  avgClaimConfidence: number;
  supportedRatio: number;
  disputedRatio: number;
  insufficientRatio: number;
  unclearRatio: number;
}

export function computeConfidenceMetrics(claims: Claim[]): ConfidenceMetrics {
  const total = Math.max(1, claims.length);
  const supported = claims.filter((c) => c.verdict === "supported").length;
  const disputed = claims.filter((c) => c.verdict === "disputed").length;
  const insufficient = claims.filter((c) => c.verdict === "insufficient_evidence").length;
  const unclear = claims.filter((c) => c.verdict === "unclear").length;
  const avgClaimConfidence = clampScore(
    claims.reduce((s, c) => s + c.confidence, 0) / total,
  );

  return {
    avgClaimConfidence,
    supportedRatio: supported / total,
    disputedRatio: disputed / total,
    insufficientRatio: insufficient / total,
    unclearRatio: unclear / total,
  };
}
