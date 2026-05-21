const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "with",
  "from",
  "by",
  "as",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "not",
  "no",
  "yes",
  "says",
  "said",
  "after",
  "before",
  "over",
  "under",
  "into",
  "about",
]);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(title: string): Set<string> {
  const normalized = normalizeTitle(title);
  const tokens = normalized.split(" ").filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/** Jaccard similarity on title word tokens (0–1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function contentHash(
  title: string,
  description: string,
  url: string,
): Promise<string> {
  const payload = `${normalizeTitle(title)}|${description.slice(0, 500)}|${url}`;
  const enc = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function stableArticleId(canonicalUrl: string): string {
  let h = 0;
  for (let i = 0; i < canonicalUrl.length; i++) {
    h = (h << 5) - h + canonicalUrl.charCodeAt(i);
    h |= 0;
  }
  return `art_${Math.abs(h).toString(36)}`;
}
