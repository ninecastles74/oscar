import { calculateAuthorScore } from "../../reliability/services/author-score.service";
import {
  appendHistory,
  getAuthorScores,
  getLatestArticleForAuthor,
  getLatestAuthor,
  listAllAuthorIds,
  saveAuthorScore,
} from "../../reliability/store";
import { recordHistoricalSnapshots } from "./snapshot-helpers";
import type { ScheduledJobResult } from "../types";

function snapAuthorName(authorId: string): string {
  return authorId.replace(/^auth_/, "").replace(/_/g, " ");
}

export function runRecalculateAuthorScoresJob(): ScheduledJobResult {
  const startedAt = new Date().toISOString();
  const errors: ScheduledJobResult["errors"] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const authorId of listAllAuthorIds()) {
    processed += 1;
    const latestArticle = getLatestArticleForAuthor(authorId);
    if (!latestArticle) {
      skipped += 1;
      continue;
    }

    try {
      const prior = getAuthorScores(authorId).map((p) => ({
        recordedAt: p.computedAt,
        score: p.overallScore,
      }));

      const author = calculateAuthorScore({
        authorId,
        displayName: getLatestAuthor(authorId)?.displayName ?? snapAuthorName(authorId),
        topic: latestArticle.topic,
        articleScore: latestArticle as import("../../reliability/types/scoring.types").ArticleScoreResult,
        scoreHistory: prior,
        version: prior.length + 1,
      });

      saveAuthorScore(author);
      appendHistory({
        entityType: "author",
        entityId: authorId,
        score: author.overallScore,
        recordedAt: author.computedAt,
        topic: latestArticle.topic,
      });
      recordHistoricalSnapshots(author, latestArticle, "author");
      updated += 1;
    } catch (err) {
      errors.push({
        entityId: authorId,
        message: err instanceof Error ? err.message : "Recalculation failed",
      });
    }
  }

  return {
    jobId: "recalculate_author_scores",
    startedAt,
    completedAt: new Date().toISOString(),
    success: errors.length === 0,
    processed,
    updated,
    skipped,
    errors,
  };
}
