import type { Category, ReliabilityCategoryId } from "@/types/news-platform";
import type { RecalculateScoresResult } from "../types/scoring.types";
import type { ArticleScoreResult } from "../types/scoring.types";
import type { AppendSnapshotInput } from "./snapshot-store";
import { appendHistoricalSnapshots } from "./snapshot-store";

const CATEGORY_METRIC_MAP: Partial<
  Record<ReliabilityCategoryId, AppendSnapshotInput["metricType"]>
> = {
  evidence_support: "evidence_support",
  cross_source_corroboration: "corroboration_rate",
  contradiction_detection: "contradiction_detection",
  sensationalism: "sensationalism",
  source_transparency: "source_transparency",
};

function categorySnapshots(
  entityType: AppendSnapshotInput["entityType"],
  entityId: string,
  article: ArticleScoreResult,
  topic: Category,
  reportId?: string,
): AppendSnapshotInput[] {
  const base = {
    entityType,
    entityId,
    topic,
    reportId,
    articleId: article.articleId,
    recordedAt: article.computedAt,
  };
  return article.categories.flatMap((cat) => {
    const metricType = CATEGORY_METRIC_MAP[cat.id];
    if (!metricType) return [];
    return [
      {
        ...base,
        metricType,
        metricKey: cat.id,
        scoreValue: cat.score,
        metadata: { weight: cat.weight, label: cat.label },
      },
    ];
  });
}

function articleMetricSnapshots(article: ArticleScoreResult, topic: Category): AppendSnapshotInput[] {
  const base = {
    entityType: "article" as const,
    entityId: article.articleId,
    topic,
    reportId: article.reportId,
    articleId: article.articleId,
    recordedAt: article.computedAt,
  };
  return [
    { ...base, metricType: "overall_score", scoreValue: article.overallScore, sampleSize: 1 },
    {
      ...base,
      metricType: "confidence",
      scoreValue: article.avgClaimConfidence,
      metadata: { appliedPenalties: article.appliedPenalties },
    },
    {
      ...base,
      metricType: "contradiction_count",
      scoreValue: article.contradictionCount,
      metadata: { penalty: article.appliedPenalties.contradictionPenalty },
    },
    ...categorySnapshots("article", article.articleId, article, topic, article.reportId),
  ];
}

/**
 * Append historical snapshots after each score computation (Prisma-aligned shape).
 */
export function recordHistoricalSnapshotsFromResult(
  result: RecalculateScoresResult,
  topic: Category,
): void {
  const { article, organization, author, topic: topicScore } = result;
  const inputs: AppendSnapshotInput[] = [...articleMetricSnapshots(article, topic)];

  if (organization) {
    const orgBase = {
      entityType: "source" as const,
      entityId: organization.organizationId,
      topic,
      reportId: article.reportId,
      articleId: article.articleId,
      recordedAt: organization.computedAt,
    };
    inputs.push(
      {
        ...orgBase,
        metricType: "overall_score",
        scoreValue: organization.overallScore,
        sampleSize: organization.articlesScored,
      },
      {
        ...orgBase,
        metricType: "rolling_average",
        scoreValue: organization.rollingAverage,
        sampleSize: organization.articlesScored,
      },
      {
        ...orgBase,
        metricType: "reporting_consistency",
        scoreValue: organization.reportingConsistency,
      },
      {
        ...orgBase,
        metricType: "corroboration_rate",
        scoreValue: organization.corroborationConfidence,
      },
      {
        ...orgBase,
        metricType: "source_transparency",
        scoreValue: organization.sourceTransparency,
      },
      {
        ...orgBase,
        metricType: "contradiction_detection",
        scoreValue: 100 - organization.contradictionFrequency,
        metadata: { contradictionFrequency: organization.contradictionFrequency },
      },
      ...categorySnapshots("source", organization.organizationId, article, topic, article.reportId),
    );
  }

  if (author) {
    const authorBase = {
      entityType: "author" as const,
      entityId: author.authorId,
      topic,
      reportId: article.reportId,
      articleId: article.articleId,
      recordedAt: author.computedAt,
    };
    inputs.push(
      {
        ...authorBase,
        metricType: "overall_score",
        scoreValue: author.overallScore,
        sampleSize: author.articlesScored,
      },
      {
        ...authorBase,
        metricType: "rolling_average",
        scoreValue: author.rollingAverage,
        sampleSize: author.articlesScored,
      },
      {
        ...authorBase,
        metricType: "reporting_consistency",
        scoreValue: author.reportingConsistency,
      },
      {
        ...authorBase,
        metricType: "corroboration_rate",
        scoreValue: author.corroborationConfidence,
      },
      ...categorySnapshots("author", author.authorId, article, topic, article.reportId),
    );
  }

  inputs.push(
    {
      entityType: "topic",
      entityId: topic,
      metricType: "overall_score",
      scoreValue: topicScore.overallScore,
      sampleSize: topicScore.articlesScored,
      topic,
      recordedAt: topicScore.computedAt,
      articleId: article.articleId,
      reportId: article.reportId,
    },
    {
      entityType: "topic",
      entityId: topic,
      metricType: "rolling_average",
      scoreValue: topicScore.rollingAverage,
      sampleSize: topicScore.articlesScored,
      topic,
      recordedAt: topicScore.computedAt,
    },
  );

  appendHistoricalSnapshots(inputs);
}
