import type {
  NewsArticle,
  StoryCluster,
  StoryConsensusReport,
} from "@/types/news-platform";
import type { StoryConsensusIntelligenceReport } from "@/server/consensus/story-intelligence";
import type { AnalyzedArticleBundle, StoryConsensusInput } from "@/server/consensus/types";

export type { AnalyzedArticleBundle, StoryConsensusInput };

/** Structured JSON from the Story Consensus service (multi-article event comparison). */
export type StoryConsensusJson = StoryConsensusReport;

/** Structured JSON from the Story Consensus Intelligence Layer. */
export type StoryConsensusIntelligenceJson = StoryConsensusIntelligenceReport;

export interface StoryConsensusFromClusterInput {
  cluster: StoryCluster;
  articles: NewsArticle[];
}

export interface StoryConsensusFromArticlesInput {
  clusterId: string;
  title: string;
  articles: NewsArticle[];
}

/** Compact summary for feeds and list views. */
export interface StoryConsensusSummaryJson {
  clusterId: string;
  title: string;
  consensusScore: number;
  disputeScore: number;
  uncertaintyScore: number;
  storyConfidence: number;
  articleCount: number;
  sourceCount: number;
  overlappingClaimCount: number;
  disputedClaimCount: number;
  omittedContextCount: number;
  computedAt: string;
}
