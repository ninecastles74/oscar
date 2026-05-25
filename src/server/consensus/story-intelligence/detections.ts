import type { NarrativeDifference, OmittedContextItem } from "@/types/news-platform";
import { analyzeNarrativeDifferences } from "../narrative-analysis";
import { detectCrossArticleOmittedContext } from "../omitted-context";
import {
  buildDisputedClaims,
  buildOverlappingClaims,
} from "../score-calculator";
import type { AlignedClaimGroup } from "../claim-alignment";
import { isDisputedGroup } from "../claim-alignment";
import type { AnalyzedArticleBundle } from "../types";

export interface EvolvingNarrativeFinding {
  aspect: string;
  description: string;
  emphasisBySource: Record<string, string>;
  severity: "info" | "warning";
}

export interface MissingEvidenceFinding {
  claimText: string;
  description: string;
  severity: "info" | "warning" | "critical";
  presentInArticleIds?: string[];
  missingFromArticleIds?: string[];
}

export interface EmergingContradictionFinding {
  groupId: string;
  canonicalText: string;
  description: string;
  severity: "significant" | "fundamental";
  sourceIds: string[];
}

export interface StoryIntelligenceDetections {
  overlappingClaims: ReturnType<typeof buildOverlappingClaims>;
  disputedClaims: ReturnType<typeof buildDisputedClaims>;
  evolvingNarratives: EvolvingNarrativeFinding[];
  missingEvidence: MissingEvidenceFinding[];
  emergingContradictions: EmergingContradictionFinding[];
}

function mapEvolvingNarratives(differences: NarrativeDifference[]): EvolvingNarrativeFinding[] {
  return differences
    .filter((d) => d.aspect !== "narrative_alignment")
    .map((d) => ({
      aspect: d.aspect,
      description: d.description,
      emphasisBySource: d.emphasisBySource,
      severity: d.aspect === "verdict_framing" ? ("warning" as const) : ("info" as const),
    }));
}

function mapMissingEvidence(
  omitted: OmittedContextItem[],
  articles: AnalyzedArticleBundle[],
): MissingEvidenceFinding[] {
  const findings: MissingEvidenceFinding[] = omitted.map((o) => ({
    claimText: o.claimText,
    description: o.description,
    severity: o.severity,
    presentInArticleIds: o.presentInArticleIds,
    missingFromArticleIds: o.missingFromArticleIds,
  }));

  for (const art of articles) {
    for (const claim of art.report.claims) {
      if (claim.verdict !== "insufficient_evidence") continue;
      findings.push({
        claimText: claim.text,
        description: "Claim marked insufficient_evidence — corroborating evidence not established.",
        severity: "warning",
        presentInArticleIds: [art.articleId],
      });
    }
  }

  return findings;
}

function mapEmergingContradictions(
  alignedGroups: AlignedClaimGroup[],
  articles: AnalyzedArticleBundle[],
): EmergingContradictionFinding[] {
  const disputed = buildDisputedClaims(alignedGroups);
  const findings: EmergingContradictionFinding[] = disputed.map((d) => ({
    groupId: d.groupId,
    canonicalText: d.canonicalText,
    description: d.description,
    severity: d.severity,
    sourceIds: d.sourceIds,
  }));

  for (const art of articles) {
    for (const c of art.results.contradictions ?? []) {
      if (findings.some((f) => f.canonicalText.includes(c.claimId))) continue;
      const claim = art.report.claims.find((cl) => cl.id === c.claimId);
      findings.push({
        groupId: `emerging_${art.articleId}_${c.claimId}`,
        canonicalText: claim?.text ?? c.claimId,
        description: c.description,
        severity: "significant",
        sourceIds: [art.sourceId],
      });
    }
  }

  for (const g of alignedGroups) {
    if (!isDisputedGroup(g)) continue;
    const hasRecentDispute = g.occurrences.some((o) => o.verdict === "disputed");
    if (hasRecentDispute && !findings.some((f) => f.groupId === g.id)) {
      findings.push({
        groupId: g.id,
        canonicalText: g.canonicalText,
        description: `Emerging cross-outlet disagreement on: "${g.canonicalText.slice(0, 80)}…"`,
        severity: "significant",
        sourceIds: [...new Set(g.occurrences.map((o) => o.sourceId))],
      });
    }
  }

  return findings;
}

export function buildStoryIntelligenceDetections(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
  omittedGroupIds: Set<string>,
): StoryIntelligenceDetections {
  const sourceCount = new Set(articles.map((a) => a.sourceId)).size;
  const singleSource = articles.length === 1 || sourceCount === 1;
  const { items: omittedContext } = detectCrossArticleOmittedContext(articles, alignedGroups);
  const narrativeDifferences = analyzeNarrativeDifferences(articles, alignedGroups);

  return {
    overlappingClaims: buildOverlappingClaims(alignedGroups, {
      includeSingleSource: singleSource,
      articles,
    }),
    disputedClaims: buildDisputedClaims(alignedGroups),
    evolvingNarratives: mapEvolvingNarratives(narrativeDifferences),
    missingEvidence: mapMissingEvidence(omittedContext, articles),
    emergingContradictions: mapEmergingContradictions(alignedGroups, articles),
  };
}
