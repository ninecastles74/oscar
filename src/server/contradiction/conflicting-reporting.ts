import type { ConflictingReportingFinding, ContradictionIssue, EvidenceItem } from "@/types/news-platform";

export function detectConflictingReporting(
  claimId: string,
  evidence: EvidenceItem[],
): { findings: ConflictingReportingFinding[]; issues: ContradictionIssue[] } {
  const findings: ConflictingReportingFinding[] = [];
  const issues: ContradictionIssue[] = [];

  const supporting = [...new Set(evidence.filter((e) => e.stance === "support").map((e) => e.sourceId))];
  const contradicting = [
    ...new Set(evidence.filter((e) => e.stance === "contradict").map((e) => e.sourceId)),
  ];

  if (supporting.length === 0 || contradicting.length === 0) {
    return { findings, issues };
  }

  const severity =
    supporting.length >= 2 && contradicting.length >= 2
      ? "fundamental"
      : supporting.length >= 1 && contradicting.length >= 1
        ? "significant"
        : "minor";

  const description = `Conflicting reporting: ${supporting.length} outlet(s) support vs ${contradicting.length} dispute the claim.`;
  findings.push({
    claimId,
    description,
    supportingSources: supporting,
    contradictingSources: contradicting,
    severity,
  });

  issues.push({
    issueId: `${claimId}_conflict_report`,
    type: "conflicting_reporting",
    claimId,
    description,
    severity,
    sourceIds: [...supporting.slice(0, 2), ...contradicting.slice(0, 2)],
  });

  const neutralHeavy =
    evidence.filter((e) => e.stance === "neutral").length >= 2 &&
    supporting.length + contradicting.length <= 1;
  if (neutralHeavy) {
    findings.push({
      claimId,
      description:
        "Outlets discuss the topic but avoid taking a clear position — split or ambiguous reporting landscape.",
      supportingSources: supporting,
      contradictingSources: contradicting,
      severity: "minor",
    });
    issues.push({
      issueId: `${claimId}_conflict_ambiguous`,
      type: "conflicting_reporting",
      claimId,
      description: findings[findings.length - 1].description,
      severity: "warning",
    });
  }

  return { findings, issues };
}
