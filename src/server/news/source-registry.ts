import { MAJOR_PUBLISHER_DOMAIN_RELIABILITY } from "./major-publishers";

/** Approved publisher domains and default reliability (0–100) for ranking. */
export const SOURCE_RELIABILITY_BY_DOMAIN: Record<string, number> = {
  ...MAJOR_PUBLISHER_DOMAIN_RELIABILITY,
  "bbc.co.uk": 92,
  "abcnews.go.com": 80,
};

export function reliabilityForDomain(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return SOURCE_RELIABILITY_BY_DOMAIN[d] ?? 55;
}
