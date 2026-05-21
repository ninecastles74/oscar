import type { ContradictionAnalysisReport, ContradictionIssue } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 28,
  fundamental: 24,
  significant: 16,
  warning: 10,
  minor: 6,
  info: 3,
};

export function computeContradictionScore(issues: ContradictionIssue[], report: {
  claimEvidenceConflicts: unknown[];
  conflictingReporting: unknown[];
  timelineInconsistencies: unknown[];
  unsupportedCausalClaims: unknown[];
}): number {
  let risk = 0;
  for (const issue of issues) {
    risk += SEVERITY_WEIGHT[issue.severity] ?? 8;
  }
  risk += report.claimEvidenceConflicts.length * 12;
  risk += report.conflictingReporting.length * 14;
  risk += report.timelineInconsistencies.length * 10;
  risk += report.unsupportedCausalClaims.length * 12;
  return clampScore(Math.min(100, risk));
}

export function buildAnalysisSummary(report: ContradictionAnalysisReport): string {
  const parts = [
    `Contradiction risk ${report.contradictionScore}/100 with ${report.issues.length} issue(s).`,
  ];
  if (report.claimEvidenceConflicts.length > 0) {
    parts.push(`${report.claimEvidenceConflicts.length} claim–evidence conflict(s).`);
  }
  if (report.articleDifferences.length > 0) {
    parts.push(`${report.articleDifferences.length} article/source difference(s).`);
  }
  if (report.conflictingReporting.length > 0) {
    parts.push(`${report.conflictingReporting.length} conflicting reporting pattern(s).`);
  }
  if (report.omittedContext.length > 0) {
    parts.push(`${report.omittedContext.length} omitted context signal(s).`);
  }
  if (report.timelineInconsistencies.length > 0) {
    parts.push(`${report.timelineInconsistencies.length} timeline inconsistency(ies).`);
  }
  if (report.unsupportedCausalClaims.length > 0) {
    parts.push(`${report.unsupportedCausalClaims.length} unsupported causal claim(s).`);
  }
  return parts.join(" ");
}
