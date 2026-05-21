import { STORIES } from "@/lib/mock-data/stories";
import type { EvidenceItem } from "@/types/news-platform";
import { APPROVED_SOURCES, approvedSourceById } from "../sources";
import type { ClassifiedClaim } from "./types";

function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h << 5) - h + text.charCodeAt(i);
  return Math.abs(h);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function buildCitation(sourceName: string, publishedAt?: string): string {
  const year = publishedAt ? new Date(publishedAt).getFullYear() : undefined;
  return year ? `[${sourceName}, ${year}]` : `[${sourceName}]`;
}

function makeEvidence(
  claimId: string,
  index: number,
  sourceId: string,
  sourceName: string,
  excerpt: string,
  url: string,
  stance: EvidenceItem["stance"],
  publishedAt?: string,
): EvidenceItem {
  const id = `${claimId}-e${index + 1}`;
  return {
    id,
    sourceId,
    sourceName,
    excerpt,
    stance,
    supports: stance === "support",
    url,
    publishedAt,
    isDirectQuote: false,
    citationLabel: buildCitation(sourceName, publishedAt),
  };
}

/**
 * 3. retrieveEvidence — gather cited passages from approved sources (with URLs).
 */
export function retrieveEvidence(claims: ClassifiedClaim[]): Record<string, EvidenceItem[]> {
  const corpus = STORIES.map((s) => ({
    story: s,
    tokens: tokenize(`${s.headline} ${s.summary}`),
  }));

  const out: Record<string, EvidenceItem[]> = {};

  for (const claim of claims) {
    const tokens = tokenize(claim.text);
    const seed = hashSeed(claim.text);

    const matches = corpus
      .map(({ story, tokens: st }) => ({ story, score: overlap(tokens, st) }))
      .filter((m) => m.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    if (matches.length === 0) {
      const fallback = APPROVED_SOURCES.slice(0, 2 + (seed % 2));
      out[claim.id] = fallback.map((src, k) =>
        makeEvidence(
          claim.id,
          k,
          src.id,
          src.name,
          "No matching passage in the approved-source index for this claim.",
          `https://${src.domain}/`,
          "neutral",
        ),
      );
      continue;
    }

    out[claim.id] = matches.map(({ story }, k) => {
      const src = approvedSourceById(story.sourceId);
      const name = src?.name ?? story.sourceId;
      const mod = (seed + k) % 5;
      const stance: EvidenceItem["stance"] =
        mod === 0 ? "contradict" : mod === 4 ? "neutral" : "support";
      return makeEvidence(
        claim.id,
        k,
        story.sourceId,
        name,
        story.summary.slice(0, 240),
        story.url,
        stance,
        story.publishedAt,
      );
    });
  }

  return out;
}
