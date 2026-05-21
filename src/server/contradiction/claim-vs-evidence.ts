import type { ClaimEvidenceConflict, ContradictionIssue, EvidenceItem } from "@/types/news-platform";

export function analyzeClaimVsEvidence(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
): { conflicts: ClaimEvidenceConflict[]; issues: ContradictionIssue[] } {
  const supporting = evidence.filter((e) => e.stance === "support");
  const contradicting = evidence.filter((e) => e.stance === "contradict");
  const neutral = evidence.filter((e) => e.stance === "neutral");
  const conflicts: ClaimEvidenceConflict[] = [];
  const issues: ContradictionIssue[] = [];

  if (supporting.length > 0 && contradicting.length > 0) {
    const severity =
      supporting.length >= 2 && contradicting.length >= 2 ? "fundamental" : "significant";
    const description = `Claim conflicts with evidence: ${supporting.length} supporting vs ${contradicting.length} contradicting passage(s).`;
    conflicts.push({
      claimId,
      supportingEvidenceIds: supporting.map((e) => e.id),
      contradictingEvidenceIds: contradicting.map((e) => e.id),
      neutralEvidenceIds: neutral.map((e) => e.id),
      description,
      severity,
    });
    issues.push({
      issueId: `${claimId}_ce_${issues.length}`,
      type: "claim_evidence_mismatch",
      claimId,
      description,
      severity,
      evidenceIds: [...supporting.slice(0, 1), ...contradicting.slice(0, 1)].map((e) => e.id),
      sourceIds: [...new Set([supporting[0].sourceId, contradicting[0].sourceId])],
    });
  }

  if (evidence.length > 0 && supporting.length === 0 && contradicting.length === 0) {
    const description =
      "Evidence does not clearly support or contradict the claim — possible mismatch between claim wording and cited passages.";
    conflicts.push({
      claimId,
      supportingEvidenceIds: [],
      contradictingEvidenceIds: [],
      neutralEvidenceIds: neutral.map((e) => e.id),
      description,
      severity: "minor",
    });
    issues.push({
      issueId: `${claimId}_ce_neutral`,
      type: "claim_evidence_mismatch",
      claimId,
      description,
      severity: "warning",
      evidenceIds: neutral.map((e) => e.id).slice(0, 3),
    });
  }

  const thinExcerpt = evidence.filter((e) => e.excerpt.length < 50 && e.stance === "support");
  if (thinExcerpt.length > 0 && /\b(confirmed|proved|definitely|always|never)\b/i.test(claimText)) {
    issues.push({
      issueId: `${claimId}_ce_strong`,
      type: "claim_evidence_mismatch",
      claimId,
      description:
        "Claim uses strong certainty language but supporting evidence excerpts are thin or indirect.",
      severity: "warning",
      evidenceIds: thinExcerpt.map((e) => e.id),
    });
  }

  return { conflicts, issues };
}
