import type { ScoreExplainability } from "@/types/news-platform";
import type { ArticlePageScores } from "@/types/article-page-scores";
import { RELIABILITY_SCORING_DISCLAIMER } from "@/types/news-platform";

/** Minimal explainability for score sheets when the full bundle did not serialize. */
export function articlePageScoresToExplainability(
  scores: ArticlePageScores,
  title: string,
): ScoreExplainability {
  return {
    entityType: "article",
    entityId: scores.articleId,
    entityLabel: title,
    overallScore: scores.weightedArticleScore,
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    whyScoreExists: `Weighted article reliability for "${title}" (${scores.weightedArticleScore}/100).`,
    howCalculated:
      "Six weighted categories are scored 0–100 from verification outputs, then combined into an overall score.",
    weightedFormula: scores.categories
      .map((c) => `${c.score} × ${c.weightPercent}%`)
      .join(" + "),
    calculationSteps: scores.categories.map((c) => ({
      categoryId: c.id,
      label: c.label,
      score: c.score,
      weightPercent: c.weightPercent,
      weightedContribution: Math.round((c.score * c.weightPercent) / 100),
      description: c.description ?? c.label,
      formulaSummary: c.formulaSummary ?? `${c.label} category score`,
    })),
    supportingEvidence: [],
    disputedEvidence: [],
    corroboratingSources: [],
    contradictionHistory: [],
    omittedContext: [],
    aiReasoningSummary: "",
    confidenceExplanation: `Verification confidence for claims on this page: ${scores.verificationConfidence}%.`,
    appliedPenalties: [],
    historicalChanges: [],
  };
}
