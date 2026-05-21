import type { ArticleReliabilityScore, Category } from "@/types/news-platform";
import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { toScoringSignals } from "./adapters/scoring-signals";
import { calculateArticleScore } from "./services/article-score.service";
import { getArticleScores } from "./store";
export { organizationIdForUrl as organizationIdForArticle } from "./utils/entity-ids";

/** @deprecated Use calculateArticleScore from services */
export function computeArticleReliabilityScore(
  report: AnalysisReport,
  results: VerificationPipelineResults,
  article: PipelineArticleContext,
  options?: { reportId?: string; topic?: Category },
): ArticleReliabilityScore {
  const prior = getArticleScores(article.submissionId);
  const result = calculateArticleScore({
    articleId: article.submissionId,
    url: article.url,
    title: article.title,
    topic: options?.topic ?? "General",
    reportId: options?.reportId ?? report.id,
    signals: toScoringSignals(report, results, article),
    scoreHistory: prior.map((p) => ({ recordedAt: p.computedAt, score: p.overallScore })),
    version: prior.length + 1,
  });
  const { avgClaimConfidence: _a, contradictionCount: _c, appliedPenalties: _p, ...score } = result;
  return score;
}
