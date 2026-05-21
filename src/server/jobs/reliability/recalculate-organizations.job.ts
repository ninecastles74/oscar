import { APPROVED_SOURCES } from "../../analysis/sources";
import { calculateSourceScore } from "../../reliability/services/source-score.service";
import {
  appendHistory,
  getLatestArticleForOrganization,
  getOrganizationScores,
  listAllOrganizationIds,
  saveOrganizationScore,
} from "../../reliability/store";
import { recordHistoricalSnapshots } from "./snapshot-helpers";
import type { ScheduledJobResult } from "../types";

function orgMeta(organizationId: string): { name: string; domain: string } {
  const domain = organizationId.replace(/^org_/, "").replace(/_/g, ".");
  const src = APPROVED_SOURCES.find((s) => s.domain === domain || s.id === organizationId);
  return { name: src?.name ?? domain, domain: src?.domain ?? domain };
}

export function runRecalculateOrganizationScoresJob(): ScheduledJobResult {
  const startedAt = new Date().toISOString();
  const errors: ScheduledJobResult["errors"] = [];
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const orgIds = listAllOrganizationIds();
  for (const organizationId of orgIds) {
    processed += 1;
    const latestArticle = getLatestArticleForOrganization(organizationId);
    if (!latestArticle) {
      skipped += 1;
      continue;
    }

    try {
      const { name, domain } = orgMeta(organizationId);
      const prior = getOrganizationScores(organizationId).map((p) => ({
        recordedAt: p.computedAt,
        score: p.overallScore,
      }));

      const organization = calculateSourceScore({
        organizationId,
        name,
        domain,
        topic: latestArticle.topic,
        articleScore: latestArticle as import("../../reliability/types/scoring.types").ArticleScoreResult,
        scoreHistory: prior,
        version: prior.length + 1,
      });

      saveOrganizationScore(organization);
      appendHistory({
        entityType: "organization",
        entityId: organizationId,
        score: organization.overallScore,
        recordedAt: organization.computedAt,
        topic: latestArticle.topic,
      });
      recordHistoricalSnapshots(organization, latestArticle, "source");
      updated += 1;
    } catch (err) {
      errors.push({
        entityId: organizationId,
        message: err instanceof Error ? err.message : "Recalculation failed",
      });
    }
  }

  const completedAt = new Date().toISOString();
  return {
    jobId: "recalculate_organization_scores",
    startedAt,
    completedAt,
    success: errors.length === 0,
    processed,
    updated,
    skipped,
    errors,
    details: { organizationCount: orgIds.length },
  };
}
