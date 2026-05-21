import type { ContradictionIssue, EvidenceItem, OmittedContextFinding } from "@/types/news-platform";

const CONTEXT_HINTS =
  /\b(without|unless|except|however|but|although|compared to|relative to|baseline|context|region|since|until|before|after)\b/i;
const HEDGE_HINTS = /\b(may|might|could|possibly|reportedly|allegedly|some|several|approximately)\b/i;
const OMISSION_SIGNALS =
  /\b(fails to mention|does not note|omits|without noting|no mention of|left out)\b/i;

const ASPECT_PATTERNS: { aspect: string; re: RegExp }[] = [
  { aspect: "temporal framing", re: /\b(before|after|since|until|during|while|when)\b/i },
  { aspect: "geographic scope", re: /\b(region|country|state|city|local|global|nationwide)\b/i },
  { aspect: "comparative baseline", re: /\b(compared to|relative to|versus|vs\.|year-over-year)\b/i },
  { aspect: "qualifications", re: /\b(however|although|except|unless|but)\b/i },
];

export function detectOmittedContext(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
): { findings: OmittedContextFinding[]; issues: ContradictionIssue[] } {
  const findings: OmittedContextFinding[] = [];
  const issues: ContradictionIssue[] = [];
  const missingAspects: string[] = [];

  for (const { aspect, re } of ASPECT_PATTERNS) {
    if (re.test(claimText)) missingAspects.push(aspect);
  }

  const neutralOnly = evidence.length > 0 && evidence.every((e) => e.stance === "neutral");
  const thinEvidence = evidence.filter((e) => e.stance !== "neutral").length < 2;
  const needsContext = CONTEXT_HINTS.test(claimText) || HEDGE_HINTS.test(claimText);

  if (neutralOnly) {
    const description =
      "Approved sources mention related topics but none take a clear position; regional or temporal context may be missing.";
    findings.push({
      claimId,
      description,
      missingAspects: missingAspects.length ? missingAspects : ["clear corroboration"],
      evidenceIds: evidence.map((e) => e.id),
      severity: "warning",
    });
    issues.push({
      issueId: `${claimId}_omit_neutral`,
      type: "omitted_context",
      claimId,
      description,
      severity: "warning",
      evidenceIds: evidence.map((e) => e.id).slice(0, 3),
    });
  }

  if (needsContext && thinEvidence) {
    const description =
      "Claim uses hedged or comparative language but corroborating passages do not supply the framing needed to interpret it.";
    findings.push({
      claimId,
      description,
      missingAspects: missingAspects.length ? missingAspects : ["interpretive framing"],
      evidenceIds: evidence.map((e) => e.id).slice(0, 3),
      severity: "warning",
    });
    issues.push({
      issueId: `${claimId}_omit_thin`,
      type: "omitted_context",
      claimId,
      description,
      severity: "warning",
      evidenceIds: evidence.map((e) => e.id).slice(0, 3),
    });
  }

  const hasContextInOne = evidence.some(
    (e) => CONTEXT_HINTS.test(e.excerpt) && e.stance === "support",
  );
  const lacksContextInOthers = evidence.some(
    (e) => !CONTEXT_HINTS.test(e.excerpt) && e.stance === "support",
  );
  if (hasContextInOne && lacksContextInOthers && evidence.length >= 2) {
    const description =
      "Some supporting sources include qualifying context that others omit — omitted context across outlets.";
    findings.push({
      claimId,
      description,
      missingAspects: ["cross-source contextual parity"],
      evidenceIds: evidence.map((e) => e.id),
      severity: "info",
    });
    issues.push({
      issueId: `${claimId}_omit_cross`,
      type: "omitted_context",
      claimId,
      description,
      severity: "info",
      evidenceIds: evidence.map((e) => e.id).slice(0, 4),
    });
  }

  if (OMISSION_SIGNALS.test(claimText)) {
    findings.push({
      claimId,
      description: "Claim text signals that important context may have been left out of coverage.",
      missingAspects: ["unspecified omitted facts"],
      evidenceIds: [],
      severity: "critical",
    });
    issues.push({
      issueId: `${claimId}_omit_signal`,
      type: "omitted_context",
      claimId,
      description: findings[findings.length - 1].description,
      severity: "critical",
    });
  }

  return { findings, issues };
}
