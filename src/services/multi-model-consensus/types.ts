import type {
  ArbitrationMethod,
  Claim,
  ClaimConsensusReport,
  ContradictionAnalysisReport,
  EvidenceItem,
  ModelClaimVerdict,
  ModelDisagreement,
  ReliabilityScoreBundle,
  Verdict,
} from "@/types/news-platform";

/** Epistemic labels only — never absolute truth. */
export const ALLOWED_VERDICTS: readonly Verdict[] = [
  "supported",
  "disputed",
  "unclear",
  "insufficient_evidence",
] as const;

export const MULTI_MODEL_DISCLAIMERS = [
  "Verdicts reflect evidence-weighted multi-model arbitration, not objective truth.",
  "Supported means corroboration outweighs dispute in available material, not proven fact.",
  "Disputed means material conflict or weak sourcing was detected, not that a claim is false.",
] as const;

export interface MultiModelArbitrationInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
  pipelineVerdict?: Verdict;
  pipelineConfidence?: number;
  contradiction?: ContradictionAnalysisReport;
}

export interface MultiModelArbitrationJson {
  claimId: string;
  claimText: string;
  finalVerdict: Verdict;
  consensusConfidenceScore: number;
  disagreementDetected: boolean;
  arbitrationMethod: ArbitrationMethod;
  disagreements: ModelDisagreement[];
  modelVerdicts: ModelClaimVerdict[];
  uncertaintyHandled: boolean;
  hallucinationMitigationApplied: boolean;
  stagesRun: string[];
  consensusSummary: string;
  disclaimers: readonly string[];
  computedAt: string;
}

export interface MultiModelWithClaimConsensusJson {
  multiModelArbitration: MultiModelArbitrationJson;
  claimConsensus: ClaimConsensusReport;
}

export interface MultiModelArbitrationBatchInput {
  claims: MultiModelArbitrationInput[];
  articleId: string;
}

export interface MultiModelArbitrationBatchJson {
  articleId: string;
  claims: MultiModelArbitrationJson[];
  overallConsensusConfidence: number;
  disagreementCount: number;
  modelsUsed: string[];
  computedAt: string;
}

export type { Claim, EvidenceItem, ReliabilityScoreBundle };
