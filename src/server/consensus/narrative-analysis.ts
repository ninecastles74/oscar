import type { NarrativeDifference } from "@/types/news-platform";
import { titleSimilarity } from "../news/utils/text";
import type { AlignedClaimGroup } from "./claim-alignment";
import type { AnalyzedArticleBundle } from "./types";

export function analyzeNarrativeDifferences(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
): NarrativeDifference[] {
  const differences: NarrativeDifference[] = [];

  const emphasisBySource: Record<string, string> = {};
  for (const art of articles) {
    const topClaim = art.report.claims[0];
    const titleOverlap = alignedGroups
      .filter((g) => titleSimilarity(g.canonicalText, art.title) >= 0.35)
      .map((g) => g.canonicalText.slice(0, 80));
    emphasisBySource[art.sourceId] = titleOverlap[0]
      ? `Headline-aligned: "${titleOverlap[0]}…"`
      : topClaim
        ? `Leads with: "${topClaim.text.slice(0, 80)}…"`
        : "No dominant factual lead extracted";
  }

  const uniqueEmphasis = new Set(Object.values(emphasisBySource));
  if (uniqueEmphasis.size > 1) {
    differences.push({
      aspect: "story_emphasis",
      description:
        "Outlets foreground different aspects of the event — headline and lead claims diverge.",
      emphasisBySource,
    });
  }

  const verdictFocus: Record<string, string> = {};
  for (const art of articles) {
    const counts = { supported: 0, disputed: 0, unclear: 0, insufficient_evidence: 0 };
    for (const c of art.report.claims) {
      counts[c.verdict] += 1;
    }
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unclear";
    verdictFocus[art.sourceId] = `Majority ${dominant} verdicts (${art.report.claims.length} claims)`;
  }

  const uniqueVerdict = new Set(Object.values(verdictFocus));
  if (uniqueVerdict.size > 1) {
    differences.push({
      aspect: "verdict_framing",
      description: "Sources reach different overall verdict patterns on extracted claims.",
      emphasisBySource: verdictFocus,
    });
  }

  if (differences.length === 0) {
    differences.push({
      aspect: "narrative_alignment",
      description: "No major narrative divergence detected across analyzed articles.",
      emphasisBySource,
    });
  }

  return differences;
}
