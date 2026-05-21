import type { ContradictionIssue, EvidenceItem, UnsupportedCausalClaim } from "@/types/news-platform";

const CAUSAL_PATTERN =
  /\b(because|due to|as a result|therefore|thus|hence|led to|caused|causing|sparked|triggered|resulted in|driven by|owing to|so that)\b/gi;

const CAUSAL_SUBSTANTIATION =
  /\b(study|data|official|confirmed|investigation|report found|attributed to|linked to|correlation)\b/i;

export function detectUnsupportedCausalClaims(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
): { findings: UnsupportedCausalClaim[]; issues: ContradictionIssue[] } {
  const findings: UnsupportedCausalClaim[] = [];
  const issues: ContradictionIssue[] = [];

  const matches = [...claimText.matchAll(CAUSAL_PATTERN)];
  if (matches.length === 0) return { findings, issues };

  const causalPhrases = matches.map((m) => m[0].toLowerCase());
  const supporting = evidence.filter((e) => e.stance === "support");
  const substantiated = supporting.some((e) => CAUSAL_SUBSTANTIATION.test(e.excerpt));
  const opinionOnly =
    supporting.length > 0 &&
    supporting.every((e) => /\b(opinion|column|analyst|believes|argues)\b/i.test(e.excerpt));

  if (!substantiated || opinionOnly) {
    const description = opinionOnly
      ? "Causal claim relies on opinion or analysis passages without independent substantiation."
      : "Causal language in the claim is not backed by evidence citing studies, official findings, or verified causal links.";
    findings.push({
      claimId,
      claimText,
      causalPhrases: [...new Set(causalPhrases)],
      description,
      evidenceIds: supporting.map((e) => e.id).slice(0, 3),
      severity: causalPhrases.length >= 2 ? "critical" : "warning",
    });
    issues.push({
      issueId: `${claimId}_causal`,
      type: "unsupported_causal_claim",
      claimId,
      description,
      severity: findings[0].severity === "critical" ? "critical" : "warning",
      evidenceIds: supporting.map((e) => e.id).slice(0, 3),
    });
  }

  const contradictsCausal = evidence.filter(
    (e) => e.stance === "contradict" && CAUSAL_PATTERN.test(e.excerpt),
  );
  if (contradictsCausal.length > 0 && matches.length > 0) {
    findings.push({
      claimId,
      claimText,
      causalPhrases,
      description:
        "Sources dispute the causal link asserted in the claim — causal attribution is contested.",
      evidenceIds: contradictsCausal.map((e) => e.id),
      severity: "critical",
    });
    issues.push({
      issueId: `${claimId}_causal_dispute`,
      type: "unsupported_causal_claim",
      claimId,
      description: findings[findings.length - 1].description,
      severity: "critical",
      evidenceIds: contradictsCausal.map((e) => e.id),
    });
  }

  return { findings, issues };
}
