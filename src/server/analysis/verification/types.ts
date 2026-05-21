import type {
  AnalysisReport,
  Claim,
  ContradictionAnalysisReport,
  EvidenceItem,
  IssueFlag,
  IssueSummary,
  SourceComparison,
  TopicClassification,
  Verdict,
} from "@/types/news-platform";
import type { PipelineArticleContext } from "../types";

export type ClaimKind =
  | "factual"
  | "statistical"
  | "attribution"
  | "prediction"
  | "opinion"
  | "procedural";

export interface ExtractedClaim {
  id: string;
  text: string;
}

export interface ClassifiedClaim extends ExtractedClaim {
  kind: ClaimKind;
  verifiable: boolean;
  topicClassification?: TopicClassification;
}

export interface ContradictionFinding {
  claimId: string;
  description: string;
  evidenceIds: [string, string];
  sourceIds: [string, string];
  severity: "minor" | "significant" | "fundamental";
}

export interface MissingContextFinding {
  claimId: string;
  description: string;
  evidenceIds: string[];
}

export interface ScoredClaim extends Claim {
  citationIds: string[];
}

export interface VerificationPipelineResults {
  article: PipelineArticleContext;
  articleTopicClassification?: TopicClassification;
  claimTopicClassifications?: Record<string, TopicClassification>;
  classifiedClaims: ClassifiedClaim[];
  evidenceByClaimId: Record<string, EvidenceItem[]>;
  comparisons: SourceComparison[];
  contradictions: ContradictionFinding[];
  missingContext: MissingContextFinding[];
  contradictionAnalyses?: Record<string, ContradictionAnalysisReport>;
  scoredClaims: ScoredClaim[];
  issueFlags: IssueFlag[];
  issueSummary: IssueSummary;
  startedAt: number;
}

export interface VerificationReportBundle {
  report: AnalysisReport;
  results: VerificationPipelineResults;
  stages: string[];
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  supported: "Supported",
  disputed: "Disputed",
  unclear: "Unclear",
  insufficient_evidence: "Insufficient Evidence",
};
