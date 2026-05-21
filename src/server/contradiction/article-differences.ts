import type { ArticleReportingDifference, ContradictionIssue, EvidenceItem } from "@/types/news-platform";
import { excerptSimilarity } from "../research/text-similarity";
import type { PeerArticleSlice } from "./types";

const FRAMING_MARKERS: Record<string, RegExp> = {
  alarmist: /\b(crisis|catastroph|chaos|devastating|shocking)\b/i,
  cautious: /\b(may|might|could|unclear|preliminary|alleged)\b/i,
  definitive: /\b(confirmed|proven|definitely|certainly|undeniably)\b/i,
};

function framingTone(text: string): string[] {
  return Object.entries(FRAMING_MARKERS)
    .filter(([, re]) => re.test(text))
    .map(([tone]) => tone);
}

/**
 * Compare reporting across evidence sources (proxy for article-to-article when peers absent).
 */
export function detectArticleDifferences(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
  peerArticles?: PeerArticleSlice[],
): { differences: ArticleReportingDifference[]; issues: ContradictionIssue[] } {
  const differences: ArticleReportingDifference[] = [];
  const issues: ContradictionIssue[] = [];

  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const a = evidence[i];
      const b = evidence[j];
      if (a.sourceId === b.sourceId) continue;

      if (
        (a.stance === "support" && b.stance === "contradict") ||
        (a.stance === "contradict" && b.stance === "support")
      ) {
        differences.push({
          claimId,
          sourceA: a.sourceId,
          sourceB: b.sourceId,
          sourceAName: a.sourceName ?? a.sourceId,
          sourceBName: b.sourceName ?? b.sourceId,
          differenceType: "stance",
          description: `${a.sourceName ?? a.sourceId} (${a.stance}) vs ${b.sourceName ?? b.sourceId} (${b.stance}) on the same claim.`,
        });
        issues.push({
          issueId: `${claimId}_art_${i}_${j}`,
          type: "article_reporting_conflict",
          claimId,
          description: differences[differences.length - 1].description,
          severity: "significant",
          evidenceIds: [a.id, b.id],
          sourceIds: [a.sourceId, b.sourceId],
        });
      }

      const sim = excerptSimilarity(a.excerpt, b.excerpt);
      const tonesA = framingTone(a.excerpt);
      const tonesB = framingTone(b.excerpt);
      const toneDiff = tonesA.filter((t) => !tonesB.includes(t));
      if (sim < 0.35 && toneDiff.length > 0 && a.stance === b.stance) {
        differences.push({
          claimId,
          sourceA: a.sourceId,
          sourceB: b.sourceId,
          sourceAName: a.sourceName ?? a.sourceId,
          sourceBName: b.sourceName ?? b.sourceId,
          differenceType: "framing",
          description: `Framing diverges (${toneDiff.join(", ")} vs ${tonesB.join(", ") || "neutral"}) despite similar stance.`,
        });
      }
    }
  }

  if (peerArticles && peerArticles.length >= 2) {
    for (let i = 0; i < peerArticles.length; i++) {
      for (let j = i + 1; j < peerArticles.length; j++) {
        const pa = peerArticles[i];
        const pb = peerArticles[j];
        const mentionsA = textMentionsClaim(pa.text, claimText);
        const mentionsB = textMentionsClaim(pb.text, claimText);
        if (!mentionsA && !mentionsB) continue;

        const tonesA = framingTone(pa.text);
        const tonesB = framingTone(pb.text);
        if (tonesA.join() !== tonesB.join()) {
          differences.push({
            claimId,
            sourceA: pa.sourceId,
            sourceB: pb.sourceId,
            sourceAName: pa.sourceName,
            sourceBName: pb.sourceName,
            differenceType: "emphasis",
            description: `Articles differ in emphasis: ${pa.sourceName} (${tonesA.join(", ") || "neutral"}) vs ${pb.sourceName} (${tonesB.join(", ") || "neutral"}).`,
            articleIds: [pa.articleId, pb.articleId],
          });
          issues.push({
            issueId: `${claimId}_peer_${pa.articleId}_${pb.articleId}`,
            type: "article_reporting_conflict",
            claimId,
            description: differences[differences.length - 1].description,
            severity: "minor",
            articleIds: [pa.articleId, pb.articleId],
            sourceIds: [pa.sourceId, pb.sourceId],
          });
        }
      }
    }
  }

  return { differences, issues };
}

function textMentionsClaim(articleText: string, claimText: string): boolean {
  const words = claimText.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  const text = articleText.toLowerCase();
  const hits = words.filter((w) => text.includes(w)).length;
  return hits >= Math.min(2, Math.max(1, Math.ceil(words.length * 0.25)));
}
