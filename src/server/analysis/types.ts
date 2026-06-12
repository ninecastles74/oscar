import type {
  AnalysisReport,
  ManualSubmission,
  ReliabilityScoreBundle,
  UserAnalysisRequest,
} from "@/types/news-platform";
import type { FinalIntelligenceSummary } from "@/types/news-platform";

export type ArticleContentRights = "user_provided" | "metadata_only" | "licensed_excerpt";

export interface ParsedArticleInput {
  title: string;
  url: string;
  summary: string;
  /** Text used for claim extraction (may be summary-only for URL ingest). */
  analysisText: string;
  author?: string;
  publishedAt?: string;
  imageUrl?: string;
  language: string;
  contentRights: ArticleContentRights;
  rightsNote: string;
}

export interface PipelineArticleContext extends ParsedArticleInput {
  submissionId: string;
}

export interface ManualAnalysisResponse {
  request: UserAnalysisRequest;
  submission: ManualSubmission;
  report: AnalysisReport;
  reliability?: ReliabilityScoreBundle;
  finalIntelligence?: FinalIntelligenceSummary;
}
