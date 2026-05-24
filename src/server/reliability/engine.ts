import type { Category, ReliabilityScoreBundle, ReliabilityScoreHistoryEntry } from "@/types/news-platform";
import type { RecalculateScoresResult } from "./types/scoring.types";
import {
  RELIABILITY_SCORING_DIMENSIONS,
  RELIABILITY_SCORING_DISCLAIMER,
} from "@/types/news-platform";
import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { contentTopicToLegacyCategory } from "../analysis/topics/map-legacy-category";
import { persistVerificationToSupabase } from "../supabase";
import { toScoringSignals } from "./adapters/scoring-signals";
import {
  appendHistory,
  getArticleIdByReport,
  getArticleScores,
  getHistory,
  getLatestAuthor,
  getLatestOrganization,
  getTopicScores,
  saveArticleScore,
  saveAuthorScore,
  saveOrganizationScore,
  saveTopicScore,
} from "./store";
import { getVerificationSnapshot, saveVerificationSnapshot } from "./snapshots";
import { recordHistoricalSnapshotsFromResult } from "./historical/record-snapshots";
import { recalculateScores } from "./services/recalculate.service";
import { buildReliabilityTrend } from "./services/trend.service";

export interface ComputeReliabilityInput {
  report: AnalysisReport;
  results: VerificationPipelineResults;
  article: PipelineArticleContext;
  reportId?: string;
  topic?: Category;
  authorDisplayName?: string;
}

export interface PersistScoresContext {
  reportId: string;
  topic: Category;
  report: AnalysisReport;
  results: VerificationPipelineResults;
  article: PipelineArticleContext;
}

/** Persist recalculated scores, history, snapshots, and verification snapshot. */
export function persistRecalculatedScores(
  result: RecalculateScoresResult,
  ctx: PersistScoresContext,
): ReliabilityScoreBundle {
  const { article: articleResult, organization, author, topic: topicScore } = result;
  const article = {
    ...articleResult,
    avgClaimConfidence: articleResult.avgClaimConfidence,
    contradictionCount: articleResult.contradictionCount,
    appliedPenalties: articleResult.appliedPenalties,
    topicClassification:
      ctx.results.articleTopicClassification ?? ctx.report.topicClassification,
  };

  saveArticleScore(article, ctx.reportId);
  if (organization) saveOrganizationScore(organization);
  if (author) saveAuthorScore(author);
  saveTopicScore(ctx.topic, topicScore);

  const historyEntries: ReliabilityScoreHistoryEntry[] = [
    {
      entityType: "article",
      entityId: article.articleId,
      score: article.overallScore,
      recordedAt: article.computedAt,
      reportId: article.reportId,
      topic: ctx.topic,
    },
    {
      entityType: "organization",
      entityId: organization!.organizationId,
      score: organization!.overallScore,
      recordedAt: organization!.computedAt,
      topic: ctx.topic,
    },
  ];
  if (author) {
    historyEntries.push({
      entityType: "author",
      entityId: author.authorId,
      score: author.overallScore,
      recordedAt: author.computedAt,
      topic: ctx.topic,
    });
  }
  historyEntries.push({
    entityType: "topic",
    entityId: ctx.topic,
    score: topicScore.overallScore,
    recordedAt: topicScore.computedAt,
    topic: ctx.topic,
  });
  for (const entry of historyEntries) appendHistory(entry);
  recordHistoricalSnapshotsFromResult(result, ctx.topic);
  saveVerificationSnapshot(ctx.reportId, ctx.report, ctx.results, ctx.article);

  void persistVerificationToSupabase(ctx.report, ctx.results, ctx.article, {
    result,
    ctx,
  }).catch((err) => {
    console.error("[supabase] persist verification failed:", err);
  });

  return {
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    scoringDimensions: RELIABILITY_SCORING_DIMENSIONS,
    article,
    organization,
    author,
    topics: [topicScore],
    trends: result.trends,
    history: getHistory(undefined, undefined).slice(-50),
    computedAt: new Date().toISOString(),
  };
}

export function computeAndStoreReliabilityScores(
  input: ComputeReliabilityInput,
): ReliabilityScoreBundle {
  const topicClassification =
    input.results.articleTopicClassification ?? input.report.topicClassification;
  const topic =
    input.topic ??
    (topicClassification
      ? contentTopicToLegacyCategory(topicClassification.primaryTopic)
      : "General");
  const articleId = input.article.submissionId;
  const priorArticle = getArticleScores(articleId).map((p) => ({
    recordedAt: p.computedAt,
    score: p.overallScore,
  }));

  const result = recalculateScores({
    report: input.report,
    signals: toScoringSignals(input.report, input.results, input.article),
    articleId,
    reportId: input.reportId ?? input.report.id,
    topic,
    topicClassification,
    authorDisplayName: input.authorDisplayName,
    priorArticleScores: priorArticle,
  });

  return persistRecalculatedScores(result, {
    reportId: input.reportId ?? input.report.id,
    topic,
    report: input.report,
    results: input.results,
    article: input.article,
  });
}

export function recalculateReliabilityScores(
  reportId: string,
  input?: ComputeReliabilityInput,
): ReliabilityScoreBundle | null {
  const snap = input
    ? { report: input.report, results: input.results, article: input.article }
    : getVerificationSnapshot(reportId);
  if (!snap) {
    const articleId = getArticleIdByReport(reportId);
    if (!articleId) return null;
    return getReliabilityBundleByArticleId(articleId);
  }
  return computeAndStoreReliabilityScores({
    report: snap.report,
    results: snap.results,
    article: snap.article,
    reportId,
    topic: input?.topic,
    authorDisplayName: input?.authorDisplayName,
  });
}

export function getReliabilityBundleByArticleId(
  articleId: string,
  version?: number,
): ReliabilityScoreBundle | null {
  const versions = getArticleScores(articleId);
  if (versions.length === 0) return null;
  const article =
    version !== undefined
      ? (versions.find((v) => v.version === version) ?? versions[versions.length - 1])
      : versions[versions.length - 1];

  const history = getHistory();
  const organization = article.organizationId
    ? (getLatestOrganization(article.organizationId) ?? null)
    : null;
  const author = article.authorId ? (getLatestAuthor(article.authorId) ?? null) : null;
  const topicSnapshots = getTopicScores(article.topic);
  const topicHistory = history.filter((h) => h.entityType === "topic" && h.topic === article.topic);

  return {
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    scoringDimensions: RELIABILITY_SCORING_DIMENSIONS,
    article,
    organization,
    author,
    topics:
      topicSnapshots.length > 0
        ? [topicSnapshots[topicSnapshots.length - 1]]
        : [
            {
              topic: article.topic,
              overallScore: article.overallScore,
              rollingAverage: buildReliabilityTrend(
                topicHistory.map((h) => ({ recordedAt: h.recordedAt, score: h.score })),
              ).rollingAverage,
              trend: buildReliabilityTrend(
                topicHistory.map((h) => ({ recordedAt: h.recordedAt, score: h.score })),
              ),
              articlesScored: topicHistory.length || 1,
              computedAt: article.computedAt,
            },
          ],
    trends: {
      article: buildReliabilityTrend(
        versions.map((v) => ({ recordedAt: v.computedAt, score: v.overallScore })),
      ),
      organization: organization?.trend ?? null,
      author: author?.trend ?? null,
    },
    history: history.filter(
      (h) =>
        h.entityId === article.articleId ||
        h.entityId === article.organizationId ||
        h.entityId === article.authorId ||
        h.topic === article.topic,
    ),
    computedAt: article.computedAt,
  };
}
