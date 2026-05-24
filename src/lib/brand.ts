/**
 * OSCAR product branding.
 * Prefer the short name "OSCAR" in UI; spell out the acronym only in footer / about copy.
 */
export const BRAND_NAME = "OSCAR";

/** Full meaning — show once (e.g. site footer), not on every screen. */
export const BRAND_ACRONYM =
  "Observational Source Consensus & Analysis Review";

export const OSCAR = {
  intelligence: "Oscar Intelligence",
  ask: "Ask Oscar",
  analysis: "Oscar Analysis",
  consensus: "Oscar Consensus",
  verified: "Oscar Verified",
  signals: "Oscar Signals",
  monitor: "Oscar Monitor",
  research: "Oscar Research",
  sources: "Oscar Sources",
  multiModel: "Oscar Multi-Model Review",
  contradiction: "Oscar Contradiction Scan",
  sourceChain: "Oscar Source Chain",
  evidence: "Oscar Evidence Weights",
  reliability: "Oscar Reliability",
  pipeline: "Oscar Pipeline",
  pricing: "Oscar Plans",
} as const;

export function pageTitle(segment: string): string {
  return `${segment} — ${BRAND_NAME}`;
}

export function defaultSiteTitle(): string {
  return `${BRAND_NAME} — ${OSCAR.intelligence}`;
}

export const OSCAR_USER_AGENT = "OscarBot/1.0 (+https://oscar.local)";
export const OSCAR_NEWS_USER_AGENT = "OscarNewsBot/1.0 (+https://oscar.local)";
