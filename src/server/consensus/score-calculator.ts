import type { StoryConsensusReport, Verdict } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";
import {
  agreementScoreForGroup,
  alignClaimsAcrossArticles,
  isDisputedGroup,
  type AlignedClaimGroup,
} from "./claim-alignment";
import type { AnalyzedArticleBundle } from "./types";

export interface ConsensusScores {
  consensusScore: number;
  disputeScore: number;
  uncertaintyScore: number;
  storyConfidence: number;
}

export function calculateConsensusScores(
  articles: AnalyzedArticleBundle[],
  alignedGroups: AlignedClaimGroup[],
): ConsensusScores {
  if (alignedGroups.length === 0 || articles.length === 0) {
    return { consensusScore: 0, disputeScore: 100, uncertaintyScore: 100, storyConfidence: 0 };
  }

  const overlapping = alignedGroups.filter(
    (g) => new Set(g.occurrences.map((o) => o.articleId)).size >= 2,
  );
  const disputed = alignedGroups.filter(isDisputedGroup);

  const agreementScores = overlapping.map(agreementScoreForGroup);
  const consensusScore =
    agreementScores.length > 0
      ? clampScore(agreementScores.reduce((a, b) => a + b, 0) / agreementScores.length)
      : clampScore(
          alignedGroups.reduce((s, g) => s + agreementScoreForGroup(g), 0) / alignedGroups.length,
        );

  const disputeScore = clampScore((disputed.length / alignedGroups.length) * 100);

  let unclearCount = 0;
  let totalClaims = 0;
  let missingCtx = 0;
  for (const art of articles) {
    for (const c of art.report.claims) {
      totalClaims += 1;
      if (c.verdict === "unclear" || c.verdict === "insufficient_evidence") unclearCount += 1;
      if (c.context) missingCtx += 1;
    }
    missingCtx += art.results.missingContext.length;
  }

  const uncertaintyScore = clampScore(
    totalClaims > 0
      ? ((unclearCount / totalClaims) * 55 + (missingCtx / Math.max(1, totalClaims)) * 45)
      : 50,
  );

  const storyConfidence = clampScore(
    consensusScore * 0.5 + (100 - disputeScore) * 0.3 + (100 - uncertaintyScore) * 0.2,
  );

  return { consensusScore, disputeScore, uncertaintyScore, storyConfidence };
}

export function buildOverlappingClaims(
  alignedGroups: AlignedClaimGroup[],
): StoryConsensusReport["overlappingClaims"] {
  return alignedGroups
    .filter((g) => new Set(g.occurrences.map((o) => o.articleId)).size >= 2)
    .map((g) => {
      const verdicts: Partial<Record<Verdict, number>> = {};
      for (const o of g.occurrences) {
        verdicts[o.verdict] = (verdicts[o.verdict] ?? 0) + 1;
      }
      return {
        groupId: g.id,
        canonicalText: g.canonicalText,
        articleIds: [...new Set(g.occurrences.map((o) => o.articleId))],
        sourceIds: [...new Set(g.occurrences.map((o) => o.sourceId))],
        agreementScore: agreementScoreForGroup(g),
        averageConfidence: Math.round(
          g.occurrences.reduce((s, o) => s + o.confidence, 0) / g.occurrences.length,
        ),
        verdicts,
      };
    });
}

export function buildDisputedClaims(
  alignedGroups: AlignedClaimGroup[],
): StoryConsensusReport["disputedClaims"] {
  return alignedGroups.filter(isDisputedGroup).map((g) => {
    const supporting = g.occurrences.filter((o) => o.verdict === "supported").map((o) => o.sourceId);
    const contradicting = g.occurrences
      .filter((o) => o.verdict === "disputed")
      .map((o) => o.sourceId);
    const severity =
      supporting.length >= 2 && contradicting.length >= 2
        ? ("fundamental" as const)
        : ("significant" as const);
    return {
      groupId: g.id,
      canonicalText: g.canonicalText,
      description: `Sources disagree on: "${g.canonicalText.slice(0, 100)}…"`,
      severity,
      sourceIds: [...new Set(g.occurrences.map((o) => o.sourceId))],
      articleIds: [...new Set(g.occurrences.map((o) => o.articleId))],
      supportingSources: [...new Set(supporting)],
      contradictingSources: [...new Set(contradicting)],
    };
  });
}

export { alignClaimsAcrossArticles };
