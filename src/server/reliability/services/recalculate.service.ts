import type { Category, TopicClassification } from "@/types/news-platform";
import { contentTopicToLegacyCategory } from "../../analysis/topics/map-legacy-category";
import { APPROVED_SOURCES } from "../../analysis/sources";
import type { RecalculateScoresInput, RecalculateScoresResult } from "../types/scoring.types";
import { updateTopicSourceReliabilityForArticle } from "../topics/topic-source-score.service";
import { organizationIdForUrl } from "../utils/entity-ids";
import { calculateArticleScore } from "./article-score.service";
import { calculateAuthorScore } from "./author-score.service";
import { calculateSourceScore } from "./source-score.service";
import { calculateTopicScore } from "./topic-score.service";
import { buildReliabilityTrend } from "./trend.service";

function resolveOrgMeta(organizationId: string): { name: string; domain: string } {
  const domain = organizationId.replace(/^org_/, "").replace(/_/g, ".");
  const src = APPROVED_SOURCES.find((s) => s.domain === domain || s.id === organizationId);
  return { name: src?.name ?? domain, domain: src?.domain ?? domain };
}

/**
 * Recalculate all reliability scores after evidence or claim updates.
 */
export function recalculateScores(input: RecalculateScoresInput): RecalculateScoresResult {
  const topic: Category =
    input.topic ??
    (input.topicClassification
      ? contentTopicToLegacyCategory(input.topicClassification.primaryTopic)
      : "General");
  const version = (input.priorArticleScores?.length ?? 0) + 1;

  const article = calculateArticleScore({
    articleId: input.articleId,
    url: input.signals.article.url,
    title: input.signals.article.title,
    topic,
    reportId: input.reportId ?? input.report.id,
    signals: input.signals,
    config: input.config,
    scoreHistory: input.priorArticleScores,
    version,
  });

  const orgId = article.organizationId ?? organizationIdForUrl(input.signals.article.url);
  const { name, domain } = resolveOrgMeta(orgId);

  const organization = calculateSourceScore({
    organizationId: orgId,
    name,
    domain,
    topic,
    articleScore: article,
    scoreHistory: input.priorSourceScores,
    config: input.config,
    version,
  });

  const author = article.authorId
    ? calculateAuthorScore({
        authorId: article.authorId,
        displayName: input.authorDisplayName ?? input.signals.article.author ?? "Unknown author",
        topic,
        articleScore: article,
        scoreHistory: input.priorAuthorScores,
        config: input.config,
        version,
      })
    : null;

  const topicScore = calculateTopicScore({
    topic,
    articleScore: article,
    scoreHistory: input.priorTopicScores,
    config: input.config,
    version,
  });

  organization.topicScores = [topicScore];

  if (input.topicClassification) {
    organization.contentTopicReliability = updateTopicSourceReliabilityForArticle(
      orgId,
      name,
      domain,
      article,
      input.topicClassification,
    );
  }

  const articleTrend = buildReliabilityTrend(
    [...(input.priorArticleScores ?? []), { recordedAt: article.computedAt, score: article.overallScore }],
    input.config,
  );

  return {
    article,
    organization,
    author,
    topic: topicScore,
    trends: {
      article: articleTrend,
      organization: organization.trend,
      author: author?.trend ?? null,
      topic: topicScore.trend,
    },
  };
}
