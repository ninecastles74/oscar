import type { AnonymousSourceFlag, EvidenceItem } from "@/types/news-platform";

const ANONYMOUS_PATTERNS: { pattern: string; re: RegExp }[] = [
  { pattern: "anonymous source", re: /\banonymous\s+(source|official|tipster)\b/i },
  { pattern: "unnamed official", re: /\bunnamed\s+official\b/i },
  { pattern: "people familiar", re: /\bpeople\s+familiar\s+with\b/i },
  { pattern: "sources said", re: /\bsources\s+(said|told|confirmed)\b/i },
  { pattern: "insider", re: /\binsider(s)?\s+(said|told)\b/i },
  { pattern: "according to sources", re: /\baccording\s+to\s+sources\b/i },
];

/** Detect opaque or anonymous attribution in claim text and evidence excerpts. */
export function detectAnonymousSourceDependency(
  evidence: EvidenceItem[],
  claimText: string,
): AnonymousSourceFlag[] {
  const flags: AnonymousSourceFlag[] = [];
  const combined = `${claimText} ${evidence.map((e) => e.excerpt).join(" ")}`;

  for (const { pattern, re } of ANONYMOUS_PATTERNS) {
    if (re.test(combined)) {
      flags.push({
        pattern,
        description: `Reporting relies on "${pattern}" — attribution chain is opaque.`,
      });
    }
  }

  for (const item of evidence) {
    for (const { pattern, re } of ANONYMOUS_PATTERNS) {
      if (re.test(item.excerpt)) {
        flags.push({
          evidenceId: item.id,
          pattern,
          description: `Evidence ${item.id} cites "${pattern}" without named attribution.`,
        });
      }
    }
  }

  const seen = new Set<string>();
  return flags.filter((f) => {
    const key = `${f.pattern}:${f.evidenceId ?? "claim"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
