import type { ContentTopic, TopicClassification, TopicSourceReliability } from "@/types/news-platform";
import type { ArticleScoreResult } from "../types/scoring.types";
import { clampScore } from "../utils/math";
import {
  getAllTopicSourceReliabilityForOrg,
  getTopicSourceReliabilityHistory,
  saveTopicSourceReliability,
} from "./topic-source-store";

export interface TopicSourceScoreInput {
  organizationId: string;
  name: string;
  domain: string;
  topic: ContentTopic;
  topicConfidence: number;
  articleScore: ArticleScoreResult;
}

/**
 * Source reliability scoped to a single ContentTopic (weighted by classification confidence).
 */
export function calculateTopicSourceReliability(
  input: TopicSourceScoreInput,
): TopicSourceReliability {
  const prior = getTopicSourceReliabilityHistory(input.organizationId, input.topic);
  const priorPoints = prior.map((p) => ({
    recordedAt: p.computedAt,
    score: p.overallScore,
  }));

  const cat = Object.fromEntries(input.articleScore.categories.map((c) => [c.id, c.score]));
  const weight = Math.max(0.35, input.topicConfidence / 100);

  const articleOverall = clampScore(input.articleScore.overallScore * weight);
  const history = [
    ...priorPoints,
    { recordedAt: input.articleScore.computedAt, score: articleOverall },
  ];
  const rollingAverage = clampScore(
    history.slice(-20).reduce((s, p) => s + p.score, 0) / Math.min(20, history.length),
  );

  return {
    topic: input.topic,
    organizationId: input.organizationId,
    name: input.name,
    domain: input.domain,
    overallScore: rollingAverage,
    rollingAverage,
    corroborationConfidence: clampScore((cat.cross_source_corroboration ?? 50) * weight),
    reportingConsistency: clampScore(
      ((cat.context_completeness ?? 50) + (cat.cross_source_corroboration ?? 50)) / 2,
    ),
    articlesScored: history.length,
    computedAt: new Date().toISOString(),
  };
}

export function updateTopicSourceReliabilityForArticle(
  organizationId: string,
  name: string,
  domain: string,
  articleScore: ArticleScoreResult,
  classification: TopicClassification,
): TopicSourceReliability[] {
  const saved: TopicSourceReliability[] = [];
  for (const { topic, confidence } of classification.topics) {
    const score = calculateTopicSourceReliability({
      organizationId,
      name,
      domain,
      topic,
      topicConfidence: confidence,
      articleScore,
    });
    saveTopicSourceReliability(score);
    saved.push(score);
  }
  return saved;
}

export function attachTopicReliabilityToOrganization(
  organizationId: string,
): TopicSourceReliability[] {
  return getAllTopicSourceReliabilityForOrg(organizationId);
}
