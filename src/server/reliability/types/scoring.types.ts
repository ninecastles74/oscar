import type {
  AnalysisReport,
  ArticleReliabilityScore,
  AuthorReliabilityScore,
  Category,
  Claim,
  TopicClassification,
  IssueSummary,
  OrganizationReliabilityScore,
  ReliabilityCategoryScore,
  ReliabilityTrend,
  ReliabilityTrendDirection,
  ReliabilityTrendPoint,
  SourceComparison,
  TopicReliabilityScore,
} from "@/types/news-platform";
import type { PipelineArticleContext } from "../../analysis/types";
import type {
  ContradictionFinding,
  MissingContextFinding,
} from "../../analysis/verification/types";
import type { ScoringConfig } from "../config/scoring-config";

/** Evidence + verification inputs used by all score calculators. */
export interface ScoringSignals {
  claims: Claim[];
  comparisons: SourceComparison[];
  contradictions: ContradictionFinding[];
  missingContext: MissingContextFinding[];
  issueSummary: IssueSummary;
  article: PipelineArticleContext;
}

export interface ArticleScoreInput {
  articleId: string;
  url: string;
  title: string;
  topic?: Category;
  reportId?: string;
  signals: ScoringSignals;
  config?: Partial<ScoringConfig>;
  /** Prior overall scores for rolling/trend (new point appended internally). */
  scoreHistory?: ReliabilityTrendPoint[];
  version?: number;
  organizationId?: string;
  authorId?: string;
}

export interface ArticleScoreResult extends ArticleReliabilityScore {
  avgClaimConfidence: number;
  contradictionCount: number;
  appliedPenalties: AppliedPenalties;
}

export interface AppliedPenalties {
  contradictionPenalty: number;
  sensationalPenalty: number;
  missingContextPenalty: number;
  insufficientEvidencePenalty: number;
}

export interface SourceScoreInput {
  organizationId: string;
  name: string;
  domain: string;
  topic: Category;
  articleScore: ArticleScoreResult;
  scoreHistory?: ReliabilityTrendPoint[];
  config?: Partial<ScoringConfig>;
  version?: number;
}

export interface AuthorScoreInput {
  authorId: string;
  displayName: string;
  topic: Category;
  articleScore: ArticleScoreResult;
  scoreHistory?: ReliabilityTrendPoint[];
  config?: Partial<ScoringConfig>;
  version?: number;
}

export interface TopicScoreInput {
  topic: Category;
  articleScore: ArticleScoreResult;
  scoreHistory?: ReliabilityTrendPoint[];
  config?: Partial<ScoringConfig>;
  version?: number;
}

export interface TrendDirectionInput {
  scoreHistory: ReliabilityTrendPoint[];
  config?: Partial<ScoringConfig>;
}

export interface TrendDirectionResult {
  direction: ReliabilityTrendDirection;
  rollingAverage: number;
  sampleSize: number;
  windowSize: number;
  recentAverage: number;
  priorAverage: number;
  delta: number;
}

export interface RecalculateScoresInput {
  report: AnalysisReport;
  signals: ScoringSignals;
  articleId: string;
  reportId?: string;
  topic?: Category;
  topicClassification?: TopicClassification;
  authorDisplayName?: string;
  config?: Partial<ScoringConfig>;
  priorArticleScores?: ReliabilityTrendPoint[];
  priorSourceScores?: ReliabilityTrendPoint[];
  priorAuthorScores?: ReliabilityTrendPoint[];
  priorTopicScores?: ReliabilityTrendPoint[];
}

export interface RecalculateScoresResult {
  article: ArticleScoreResult;
  organization: OrganizationReliabilityScore | null;
  author: AuthorReliabilityScore | null;
  topic: TopicReliabilityScore;
  trends: {
    article: ReliabilityTrend;
    organization: ReliabilityTrend | null;
    author: ReliabilityTrend | null;
    topic: ReliabilityTrend;
  };
}

export type { ReliabilityCategoryScore, ScoringConfig };
