import type { ArticleReliabilityScore, AuthorReliabilityScore, Category } from "@/types/news-platform";
import { calculateAuthorScore } from "./services/author-score.service";
import { getAuthorScores } from "./store";

/** @deprecated Use calculateAuthorScore from services */
export function computeAuthorReliabilityScore(
  authorId: string,
  displayName: string,
  articleScore: ArticleReliabilityScore,
  topic: Category,
): AuthorReliabilityScore {
  const prior = getAuthorScores(authorId);
  return calculateAuthorScore({
    authorId,
    displayName,
    topic,
    articleScore: articleScore as import("./types/scoring.types").ArticleScoreResult,
    scoreHistory: prior.map((p) => ({ recordedAt: p.computedAt, score: p.overallScore })),
    version: prior.length + 1,
  });
}
