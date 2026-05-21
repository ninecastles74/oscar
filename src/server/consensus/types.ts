import type { AnalysisReport } from "@/types/news-platform";
import type { VerificationPipelineResults } from "../analysis/verification/types";

export interface AnalyzedArticleBundle {
  articleId: string;
  url: string;
  title: string;
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
  publishedAt?: string;
  analysisText: string;
  report: AnalysisReport;
  results: VerificationPipelineResults;
}

export interface StoryConsensusInput {
  clusterId: string;
  title: string;
  summary?: string;
  articles: AnalyzedArticleBundle[];
}
