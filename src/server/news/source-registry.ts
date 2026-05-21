/** Approved publisher domains and default reliability (0–100) for ranking. */
export const SOURCE_RELIABILITY_BY_DOMAIN: Record<string, number> = {
  "reuters.com": 96,
  "apnews.com": 95,
  "bbc.com": 92,
  "bbc.co.uk": 92,
  "nytimes.com": 88,
  "wsj.com": 89,
  "theguardian.com": 85,
  "ft.com": 91,
  "bloomberg.com": 90,
  "npr.org": 87,
  "aljazeera.com": 80,
  "politico.com": 82,
  "axios.com": 83,
};

export function reliabilityForDomain(domain: string): number {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return SOURCE_RELIABILITY_BY_DOMAIN[d] ?? 55;
}
