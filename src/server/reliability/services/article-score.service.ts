import type { Category } from "@/types/news-platform";
import { mergeScoringConfig, validateScoringConfig } from "../config/scoring-config";
import { calculateCategoryScores } from "../calculators/categories";
import { weightedSum } from "../utils/math";
import { authorIdFromName, organizationIdForUrl } from "../utils/entity-ids";
import type { ArticleScoreInput, ArticleScoreResult } from "../types/scoring.types";

/**
 * Calculate evidence-weighted article reliability (per-claim signals, not objective truth).
 */
export function calculateArticleScore(input: ArticleScoreInput): ArticleScoreResult {
  const config = mergeScoringConfig(input.config);
  validateScoringConfig(config);

  const { categories, penalties, avgClaimConfidence, contradictionCount } =
    calculateCategoryScores(input.signals, config);

  const overallScore = weightedSum(
    categories.map((c) => ({ score: c.score, weight: c.weight })),
  );

  const topic: Category = input.topic ?? "General";
  const computedAt = new Date().toISOString();

  return {
    articleId: input.articleId,
    reportId: input.reportId,
    url: input.url,
    title: input.title,
    topic,
    overallScore,
    categories,
    organizationId: input.organizationId ?? organizationIdForUrl(input.url),
    authorId: input.authorId ?? authorIdFromName(input.signals.article.author),
    computedAt,
    version: input.version ?? 1,
    avgClaimConfidence,
    contradictionCount,
    appliedPenalties: penalties,
  };
}
