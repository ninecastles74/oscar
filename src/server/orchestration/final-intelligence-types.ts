import type { AnalysisReport, ReliabilityScoreBundle, Verdict } from "@/types/news-platform";
import { RELIABILITY_SCORING_DISCLAIMER } from "@/types/news-platform";
import type {
  ArticleOrchestrationInput,
  ArticleOrchestrationReport,
  ClusterOrchestrationInput,
  ClusterOrchestrationReport,
  OrchestrationStage,
} from "./types";

export const FINAL_INTELLIGENCE_DISCLAIMER =
  `${RELIABILITY_SCORING_DISCLAIMER} Final scores are epistemic reliability and confidence indicators — not declarations of objective truth.`;

export interface FinalIntelligenceInput {
  article: ArticleOrchestrationInput["article"];
  trigger?: ArticleOrchestrationInput["trigger"];
  skipMultiModel?: boolean;
  reportId?: string;
  authorDisplayName?: string;
  cluster?: ClusterOrchestrationInput;
  /** Skip article pipeline if already completed. */
  articleResult?: ArticleOrchestrationReport;
  clusterResult?: ClusterOrchestrationReport;
}

export interface FinalClaimSignalSummary {
  claimId: string;
  evidenceQualityScore: number;
  sourceIndependenceScore: number;
  contradictionScore: number;
  hallucinationRiskScore: number;
  consensusVerdict: Verdict;
  consensusConfidence: number;
}

/** Structured output from the Final Intelligence Orchestration Layer. */
export interface FinalIntelligenceReport {
  finalArticleReliability: number;
  finalSourceReliability: number | null;
  finalAuthorReliability: number | null;
  finalStoryConfidence: number | null;
  finalUncertaintyLevel: number;
  disclaimer: string;
  intelligenceSummary: string;
  article: ArticleOrchestrationReport;
  cluster?: ClusterOrchestrationReport;
  claimSignals: FinalClaimSignalSummary[];
  enginesRun: OrchestrationStage[];
  computedAt: string;
}

export type { ArticleOrchestrationReport, ClusterOrchestrationReport, ReliabilityScoreBundle, AnalysisReport };
