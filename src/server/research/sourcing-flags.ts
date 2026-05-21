import type {
  AnonymousSourceFlag,
  ResearchEvidence,
  UnsupportedAssessment,
  WeakSourcingFlag,
} from "@/types/news-platform";

const ANONYMOUS_PATTERNS = [
  { pattern: "anonymous source", re: /\banonymous\s+(source|official|tipster)\b/i },
  { pattern: "unnamed official", re: /\bunnamed\s+official\b/i },
  { pattern: "people familiar", re: /\bpeople\s+familiar\s+with\b/i },
  { pattern: "sources said", re: /\bsources\s+(said|told|confirmed)\b/i },
  { pattern: "insider", re: /\binsider(s)?\s+(said|told)\b/i },
];

const WEAK_EXCERPT =
  /\b(no matching passage|not available|index for this claim|unable to verify)\b/i;

export function detectWeakSourcing(
  items: ResearchEvidence[],
  claimText: string,
): { items: ResearchEvidence[]; flags: WeakSourcingFlag[] } {
  const flags: WeakSourcingFlag[] = [];
  const updated = items.map((e) => {
    let weak = false;
    if (WEAK_EXCERPT.test(e.excerpt)) {
      weak = true;
      flags.push({
        evidenceId: e.id,
        reason: "Passage does not substantively address the claim.",
        severity: "critical",
      });
    } else if (e.stance === "neutral" && e.excerpt.length < 60) {
      weak = true;
      flags.push({
        evidenceId: e.id,
        reason: "Thin neutral mention without clear factual grounding.",
        severity: "warning",
      });
    } else if (!e.url || e.url.endsWith("/")) {
      weak = true;
      flags.push({
        evidenceId: e.id,
        reason: "Missing or generic source URL.",
        severity: "info",
      });
    }
    return { ...e, weakSourcing: weak };
  });

  if (items.length === 0) {
    flags.push({
      evidenceId: "none",
      reason: "No evidence retrieved from approved sources.",
      severity: "critical",
    });
  }

  return { items: updated, flags };
}

export function detectAnonymousSources(
  items: ResearchEvidence[],
  claimText: string,
): { items: ResearchEvidence[]; flags: AnonymousSourceFlag[] } {
  const flags: AnonymousSourceFlag[] = [];
  const combined = `${claimText} ${items.map((e) => e.excerpt).join(" ")}`;

  for (const { pattern, re } of ANONYMOUS_PATTERNS) {
    if (re.test(combined)) {
      flags.push({
        pattern,
        description: `Reporting relies on "${pattern}" — attribution chain is opaque.`,
      });
    }
  }

  const updated = items.map((e) => ({
    ...e,
    citesAnonymousSource: ANONYMOUS_PATTERNS.some((p) => p.re.test(e.excerpt)),
  }));

  return { items: updated, flags };
}

export function assessUnsupported(
  items: ResearchEvidence[],
  claimVerifiable = true,
): UnsupportedAssessment {
  const supporting = items.filter((e) => e.stance === "support" && !e.weakSourcing);
  const independent = supporting.filter((e) => e.isIndependentConfirmation);

  if (!claimVerifiable) {
    return {
      isUnsupported: true,
      reason: "Claim is classified as non-verifiable opinion or prediction.",
      supportingSourceCount: supporting.length,
      independentSourceCount: independent.length,
    };
  }

  if (supporting.length === 0) {
    return {
      isUnsupported: true,
      reason: "No supporting evidence from approved sources.",
      supportingSourceCount: 0,
      independentSourceCount: 0,
    };
  }

  if (independent.length === 0 && supporting.length < 2) {
    return {
      isUnsupported: true,
      reason: "Only syndicated or weak sourcing — no independent confirmation.",
      supportingSourceCount: supporting.length,
      independentSourceCount: 0,
    };
  }

  return {
    isUnsupported: false,
    reason: `${independent.length} independent and ${supporting.length} total supporting source(s).`,
    supportingSourceCount: supporting.length,
    independentSourceCount: independent.length,
  };
}
