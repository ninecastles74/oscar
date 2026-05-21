import type { ArticleReliabilityScore, Category, TopicReliabilityScore } from "@/types/news-platform";
import { calculateTopicScore } from "./services/topic-score.service";
import { getTopicScores } from "./store";

/** @deprecated Use calculateTopicScore from services */
export function computeTopicReliabilityScore(
  topic: Category,
  articleScore: ArticleReliabilityScore,
): TopicReliabilityScore {
  const prior = getTopicScores(topic);
  return calculateTopicScore({
    topic,
    articleScore: articleScore as import("./types/scoring.types").ArticleScoreResult,
    scoreHistory: prior.map((p) => ({ recordedAt: p.computedAt, score: p.overallScore })),
    version: prior.length + 1,
  });
}
