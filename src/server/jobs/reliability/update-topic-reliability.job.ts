import { calculateTopicScore } from "../../reliability/services/topic-score.service";
import {
  ALL_CATEGORIES,
  appendHistory,
  getLatestArticleForTopic,
  getTopicScores,
  listAllTopics,
  saveTopicScore,
} from "../../reliability/store";
import { recordHistoricalSnapshots } from "./snapshot-helpers";
import type { ScheduledJobResult } from "../types";
import type { Category } from "@/types/news-platform";

export function runUpdateTopicReliabilityJob(): ScheduledJobResult {
  const startedAt = new Date().toISOString();
  const errors: ScheduledJobResult["errors"] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const topics = new Set<Category>([...ALL_CATEGORIES, ...listAllTopics()]);

  for (const topic of topics) {
    processed += 1;
    const latestArticle = getLatestArticleForTopic(topic);
    if (!latestArticle) {
      skipped += 1;
      continue;
    }

    try {
      const prior = getTopicScores(topic).map((p) => ({
        recordedAt: p.computedAt,
        score: p.overallScore,
      }));

      const topicScore = calculateTopicScore({
        topic,
        articleScore: latestArticle as import("../../reliability/types/scoring.types").ArticleScoreResult,
        scoreHistory: prior,
        version: prior.length + 1,
      });

      saveTopicScore(topic, topicScore);
      appendHistory({
        entityType: "topic",
        entityId: topic,
        score: topicScore.overallScore,
        recordedAt: topicScore.computedAt,
        topic,
      });
      recordHistoricalSnapshots(topicScore, latestArticle, "topic");
      updated += 1;
    } catch (err) {
      errors.push({
        entityId: topic,
        message: err instanceof Error ? err.message : "Topic update failed",
      });
    }
  }

  return {
    jobId: "update_topic_reliability",
    startedAt,
    completedAt: new Date().toISOString(),
    success: errors.length === 0,
    processed,
    updated,
    skipped,
    errors,
    details: { topicCount: topics.size },
  };
}
