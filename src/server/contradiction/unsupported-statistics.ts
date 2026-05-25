import type {
  ContradictionIssue,
  EvidenceItem,
  UnsupportedStatisticFinding,
} from "@/types/news-platform";

const STAT_IN_CLAIM =
  /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(%|percent|percentage|million|billion|trillion|thousand|fold|times)\b|\b\d+(?:\.\d+)?\s*(million|billion|trillion)\b/gi;

const STAT_SUBSTANTIATION =
  /\b(census|survey|data|dataset|statistics|figures|study|researchers|official|bureau|according to|reported by|peer-reviewed|methodology|sample size)\b/i;

const UNSOURCED_STAT =
  /\b(some estimate|roughly|about|around|approximately|as many as|up to|could be|may be)\s+\d/gi;

export function detectUnsupportedStatistics(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
): { findings: UnsupportedStatisticFinding[]; issues: ContradictionIssue[] } {
  const findings: UnsupportedStatisticFinding[] = [];
  const issues: ContradictionIssue[] = [];

  const statMatches = [...claimText.matchAll(STAT_IN_CLAIM)];
  if (statMatches.length === 0) return { findings, issues };

  const statisticPhrases = [
    ...new Set(statMatches.map((m) => m[0].trim()).filter(Boolean)),
  ].slice(0, 8);

  const supporting = evidence.filter((e) => e.stance === "support" || e.supports);
  const substantiated = supporting.some((e) => STAT_SUBSTANTIATION.test(e.excerpt));
  const unsourcedTone = UNSOURCED_STAT.test(claimText);

  if (!substantiated || unsourcedTone) {
    const description = !substantiated
      ? "Numerical claim lacks corroborating evidence citing data sources, studies, or official statistics."
      : "Statistic uses hedged or unsourced phrasing without verifiable data attribution in evidence.";
    const severity: "warning" | "critical" =
      statisticPhrases.length >= 2 || !substantiated ? "critical" : "warning";

    findings.push({
      claimId,
      statisticPhrases,
      description,
      evidenceIds: supporting.map((e) => e.id).slice(0, 3),
      severity,
    });
    issues.push({
      issueId: `${claimId}_stat`,
      type: "unsupported_statistic",
      claimId,
      description,
      severity: severity === "critical" ? "critical" : "warning",
      evidenceIds: supporting.map((e) => e.id).slice(0, 3),
    });
  }

  const contradicts = evidence.filter(
    (e) => e.stance === "contradict" && STAT_IN_CLAIM.test(e.excerpt),
  );
  if (contradicts.length > 0) {
    findings.push({
      claimId,
      statisticPhrases,
      description: "Sources cite conflicting figures for the same quantitative claim.",
      evidenceIds: contradicts.map((e) => e.id),
      severity: "critical",
    });
    issues.push({
      issueId: `${claimId}_stat_conflict`,
      type: "unsupported_statistic",
      claimId,
      description: findings[findings.length - 1].description,
      severity: "critical",
      evidenceIds: contradicts.map((e) => e.id),
    });
  }

  return { findings, issues };
}
