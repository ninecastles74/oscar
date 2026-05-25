import type {
  Claim,
  ClaimConsensusBatchReport,
  ClaimConsensusReport,
  ReliabilityScoreBundle,
  Verdict,
} from "@/types/news-platform";

export interface ClaimConsensusInput {
  claim: Claim;
  reliability?: ReliabilityScoreBundle | null;
}

export interface ClaimConsensusBatchInput {
  claims: Claim[];
  articleId: string;
  reliability?: ReliabilityScoreBundle | null;
}

/** Structured JSON for a single claim consensus result. */
export type ClaimConsensusJson = ClaimConsensusReport;

/** Structured JSON for batch claim consensus. */
export type ClaimConsensusBatchJson = ClaimConsensusBatchReport;

export interface ClaimConsensusSummaryJson {
  claimId: string;
  verdict: Verdict;
  confidence: number;
  compositeScore: number;
  signalCount: number;
}
