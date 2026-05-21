import type { ExtractedClaim } from "./types";

const FACTUAL_RE =
  /\b(\d+%?|\d{4}|said|says|reported|according|million|billion|study|data|official|government|confirmed|announced|will|has|have|is|are|was|were)\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35 && s.length <= 320);
}

function scoreSentence(s: string): number {
  let score = 0;
  if (FACTUAL_RE.test(s)) score += 2;
  if (/\d/.test(s)) score += 1;
  if (/\b(may|might|could|possibly|allegedly)\b/i.test(s)) score += 1;
  if (/\b(I think|in my view|beautiful|terrible|worst|best)\b/i.test(s)) score -= 3;
  return score;
}

/**
 * 1. extractClaims — pull discrete, checkable statements from article text.
 */
export function extractClaims(articleText: string, prefixId: string): ExtractedClaim[] {
  const ranked = splitSentences(articleText)
    .map((s) => ({ s, score: scoreSentence(s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked = ranked.slice(0, 12);
  if (picked.length === 0 && articleText.trim().length > 40) {
    picked.push({ s: articleText.trim().slice(0, 280), score: 1 });
  }

  return picked.map((item, i) => ({
    id: `${prefixId}-claim-${i + 1}`,
    text: item.s,
  }));
}
