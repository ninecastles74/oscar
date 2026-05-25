import type {
  AnalysisReport,
  NewsArticle,
  ReliabilityScoreBundle,
  StoryCluster,
  StoryConsensusReport,
  TransparencyExplainabilityBundle,
} from "@/types/news-platform";
import type { AnalysisTrigger } from "../analysis/context";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import type { PipelineArticleContext } from "../analysis/types";
import type { StoryConsensusIntelligenceReport } from "../consensus/story-intelligence/types";
import type { ScoreExplainability } from "@/types/news-platform";
import type { ScheduledNewsRunResult } from "../jobs/news/scheduled-pipeline";

export type OrchestrationStage =
  | "verification"
  | "multi_model"
  | "reliability"
  | "claim_consensus"
  | "transparency"
  | "story_consensus"
  | "story_intelligence"
  | "evidence_weighting"
  | "source_tracing"
  | "contradiction_analysis"
  | "narrative_analysis"
  | "consensus_arbitration"
  | "historical_reliability"
  | "hallucination_detection"
  | "explainability"
  | "final_intelligence"
  | "ingest"
  | "scheduled_feed";

export interface ArticleOrchestrationInput {
  article: PipelineArticleContext;
  trigger?: AnalysisTrigger;
  skipMultiModel?: boolean;
  reportId?: string;
  authorDisplayName?: string;
}

export interface ArticleOrchestrationReport {
  articleId: string;
  report: AnalysisReport;
  results: VerificationPipelineResults;
  reliability: ReliabilityScoreBundle;
  transparency: TransparencyExplainabilityBundle;
  stagesCompleted: OrchestrationStage[];
  computedAt: string;
}

export interface ClusterOrchestrationInput {
  cluster: StoryCluster;
  articles: NewsArticle[];
  onlyAnalyzeArticleIds?: string[];
  includeStoryIntelligence?: boolean;
}

export interface ClusterOrchestrationReport {
  clusterId: string;
  storyConsensus: StoryConsensusReport;
  storyExplainability: ScoreExplainability;
  storyIntelligence?: StoryConsensusIntelligenceReport;
  articlesAnalyzed: number;
  stagesCompleted: OrchestrationStage[];
  computedAt: string;
}

export type ScheduledOrchestrationReport = ScheduledNewsRunResult & {
  stagesCompleted: OrchestrationStage[];
};
