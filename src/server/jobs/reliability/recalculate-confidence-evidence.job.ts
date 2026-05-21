import { toScoringSignals } from "../../reliability/adapters/scoring-signals";
import { persistRecalculatedScores } from "../../reliability/engine";
import { dequeueEvidenceRecalculations, peekEvidenceRecalculationQueue } from "../../reliability/evidence-queue";
import { recalculateScores } from "../../reliability/services/recalculate.service";
import {
  getArticleScores,
  getAuthorScores,
  getOrganizationScores,
  getTopicScores,
} from "../../reliability/store";
import { getVerificationSnapshot } from "../../reliability/snapshots";
import type { ScheduledJobResult } from "../types";

export function runRecalculateConfidenceEvidenceJob(): ScheduledJobResult {
  const startedAt = new Date().toISOString();
  const errors: ScheduledJobResult["errors"] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const queued = dequeueEvidenceRecalculations();

  if (queued.length === 0) {
    return {
      jobId: "recalculate_confidence_evidence",
      startedAt,
      completedAt: new Date().toISOString(),
      success: true,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      details: { queuedCount: 0, message: "No pending evidence updates" },
    };
  }

  for (const reportId of queued) {
    processed += 1;
    const snap = getVerificationSnapshot(reportId);
    if (!snap) {
      skipped += 1;
      continue;
    }

    const articleId = snap.article.submissionId;
    const topic = snap.report.claims[0]
      ? (getArticleScores(articleId)[0]?.topic ?? "General")
      : "General";
    const latestVersions = getArticleScores(articleId);
    const topicFromLatest = latestVersions[latestVersions.length - 1]?.topic ?? topic;

    try {
      const priorArticle = latestVersions.map((p) => ({
        recordedAt: p.computedAt,
        score: p.overallScore,
      }));
      const orgId = latestVersions[latestVersions.length - 1]?.organizationId;
      const authorId = latestVersions[latestVersions.length - 1]?.authorId;

      const result = recalculateScores({
        report: snap.report,
        signals: toScoringSignals(snap.report, snap.results, snap.article),
        articleId,
        reportId,
        topic: topicFromLatest,
        topicClassification:
          snap.results.articleTopicClassification ?? snap.report.topicClassification,
        authorDisplayName: snap.article.author,
        priorArticleScores: priorArticle,
        priorSourceScores: orgId
          ? getOrganizationScores(orgId).map((p) => ({
              recordedAt: p.computedAt,
              score: p.overallScore,
            }))
          : undefined,
        priorAuthorScores: authorId
          ? getAuthorScores(authorId).map((p) => ({
              recordedAt: p.computedAt,
              score: p.overallScore,
            }))
          : undefined,
        priorTopicScores: getTopicScores(topicFromLatest).map((p) => ({
          recordedAt: p.computedAt,
          score: p.overallScore,
        })),
      });

      persistRecalculatedScores(result, {
        reportId,
        topic: topicFromLatest,
        report: snap.report,
        results: snap.results,
        article: snap.article,
      });
      updated += 1;
    } catch (err) {
      errors.push({
        entityId: reportId,
        message: err instanceof Error ? err.message : "Confidence recalculation failed",
      });
    }
  }

  return {
    jobId: "recalculate_confidence_evidence",
    startedAt,
    completedAt: new Date().toISOString(),
    success: errors.length === 0,
    processed,
    updated,
    skipped,
    errors,
    details: {
      queuedCount: queued.length,
      remainingQueue: peekEvidenceRecalculationQueue().length,
    },
  };
}
