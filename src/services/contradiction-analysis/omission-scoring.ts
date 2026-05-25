import type { ContradictionAnalysisReport } from "@/types/news-platform";
import { clampScore } from "@/server/reliability/utils/math";

/** 0–100: risk of contradictions across evidence and articles. */
export function contradictionScoreFromReport(report: ContradictionAnalysisReport): number {
  return report.contradictionScore;
}

/** 0–100: risk that important context is missing or thin. */
export function computeOmissionScore(report: ContradictionAnalysisReport): number {
  let risk = 0;

  for (const o of report.omittedContext) {
    risk += o.severity === "critical" ? 28 : o.severity === "warning" ? 16 : 8;
    risk += Math.min(12, o.missingAspects.length * 4);
  }

  risk += report.timelineInconsistencies.length * 12;
  risk += (report.unsupportedStatistics?.length ?? 0) * 14;

  const thinEvidence =
    report.claimEvidenceConflicts.length === 0 &&
    report.omittedContext.length > 0 &&
    report.conflictingReporting.length === 0;
  if (thinEvidence) risk += 10;

  return clampScore(Math.min(100, risk));
}

/** 0–100: how complete contextual framing is (higher is better). */
export function computeContextCompletenessScore(
  report: ContradictionAnalysisReport,
  omissionScore: number,
): number {
  let score = 100 - omissionScore * 0.85;

  const supporting = report.claimEvidenceConflicts.flatMap((c) => c.supportingEvidenceIds);
  if (supporting.length >= 2) score += 8;
  if (report.articleDifferences.length > 0 && report.conflictingReporting.length === 0) {
    score += 5;
  }

  const criticalOmit = report.omittedContext.filter((o) => o.severity === "critical").length;
  score -= criticalOmit * 15;

  return clampScore(Math.round(score));
}

/** 0–100: emotional / exaggerated framing intensity. */
export function framingIntensityScoreFromReport(report: ContradictionAnalysisReport): number {
  if (report.framingIntensityScore != null) return report.framingIntensityScore;
  const top = report.emotionalExaggeration?.[0]?.intensityScore;
  return top != null ? clampScore(top) : 0;
}
