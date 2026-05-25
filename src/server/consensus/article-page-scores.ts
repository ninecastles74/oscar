import type {
  AnalysisReport,
  ReliabilityScoreBundle,
  StoryConsensusReport,
} from "@/types/news-platform";
import type { ArticlePageScores } from "@/types/article-page-scores";

export type { ArticlePageScores };

export function buildArticlePageScores(
  articleId: string,
  reliability: ReliabilityScoreBundle,
  report: AnalysisReport,
  storyReport?: StoryConsensusReport | null,
): ArticlePageScores {
  return {
    articleId,
    weightedArticleScore: reliability.article.overallScore,
    verificationConfidence: report.overallConfidence,
    story: storyReport
      ? {
          consensusScore: storyReport.consensusScore,
          disputeScore: storyReport.disputeScore,
          uncertaintyScore: storyReport.uncertaintyScore,
          storyConfidence: storyReport.storyConfidence,
        }
      : null,
    categories: reliability.article.categories.map((c) => ({
      id: c.id,
      label: c.label,
      score: c.score,
      weightPercent: Math.round(c.weight * 100),
      description: c.description,
      formulaSummary: c.formulaSummary,
    })),
  };
}
