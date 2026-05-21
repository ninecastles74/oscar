import type { Verdict } from "@/types/news-platform";
import { titleSimilarity } from "../news/utils/text";
import type { AnalyzedArticleBundle } from "./types";

const ALIGN_THRESHOLD = 0.52;

export interface ClaimOccurrence {
  articleId: string;
  sourceId: string;
  sourceName: string;
  claimId: string;
  text: string;
  verdict: Verdict;
  confidence: number;
}

export interface AlignedClaimGroup {
  id: string;
  canonicalText: string;
  occurrences: ClaimOccurrence[];
}

export function extractClaimOccurrences(articles: AnalyzedArticleBundle[]): ClaimOccurrence[] {
  const out: ClaimOccurrence[] = [];
  for (const art of articles) {
    for (const claim of art.report.claims) {
      out.push({
        articleId: art.articleId,
        sourceId: art.sourceId,
        sourceName: art.sourceName,
        claimId: claim.id,
        text: claim.text,
        verdict: claim.verdict,
        confidence: claim.confidence,
      });
    }
  }
  return out;
}

/** Group similar claims across articles (overlapping statements). */
export function alignClaimsAcrossArticles(articles: AnalyzedArticleBundle[]): AlignedClaimGroup[] {
  const occurrences = extractClaimOccurrences(articles);
  const groups: AlignedClaimGroup[] = [];

  for (const occ of occurrences) {
    let matched: AlignedClaimGroup | undefined;
    for (const g of groups) {
      if (titleSimilarity(g.canonicalText, occ.text) >= ALIGN_THRESHOLD) {
        matched = g;
        break;
      }
    }
    if (matched) {
      matched.occurrences.push(occ);
      if (occ.text.length > matched.canonicalText.length) {
        matched.canonicalText = occ.text;
      }
    } else {
      groups.push({
        id: `cg_${groups.length + 1}`,
        canonicalText: occ.text,
        occurrences: [occ],
      });
    }
  }

  return groups;
}

export function agreementScoreForGroup(group: AlignedClaimGroup): number {
  const sources = new Set(group.occurrences.map((o) => o.sourceId));
  if (sources.size <= 1) return group.occurrences[0]?.confidence ?? 50;

  const verdicts = group.occurrences.map((o) => o.verdict);
  const supported = verdicts.filter((v) => v === "supported").length;
  const disputed = verdicts.filter((v) => v === "disputed").length;
  const unclear = verdicts.filter((v) => v === "unclear" || v === "insufficient_evidence").length;

  if (disputed > 0 && supported > 0) {
    return Math.max(20, 50 - disputed * 15);
  }
  if (supported === verdicts.length) {
    return Math.round(
      group.occurrences.reduce((s, o) => s + o.confidence, 0) / verdicts.length,
    );
  }
  if (unclear === verdicts.length) return 35;
  return Math.round((supported / verdicts.length) * 70 + (1 - unclear / verdicts.length) * 20);
}

export function isDisputedGroup(group: AlignedClaimGroup): boolean {
  const verdicts = new Set(group.occurrences.map((o) => o.verdict));
  if (verdicts.has("supported") && verdicts.has("disputed")) return true;
  if (verdicts.has("disputed") && verdicts.size >= 2) return true;
  const sources = new Set(group.occurrences.map((o) => o.sourceId));
  return sources.size >= 2 && verdicts.has("disputed");
}
