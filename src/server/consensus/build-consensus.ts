import type { StoryConsensusReport } from "@/types/news-platform";
import { alignClaimsAcrossArticles } from "./claim-alignment";
import { analyzeEmotionalFraming } from "./framing-analysis";
import { analyzeNarrativeDifferences } from "./narrative-analysis";
import { detectCrossArticleOmittedContext } from "./omitted-context";
import { buildSourceAgreementMap } from "./source-agreement-map";
import {
  buildDisputedClaims,
  buildOverlappingClaims,
  calculateConsensusScores,
} from "./score-calculator";
import type { StoryConsensusInput } from "./types";
import { buildConsensusFindingsSummary } from "@/lib/consensus-findings-summary";

/**
 * Story consensus engine — compare articles on the same event (one or more sources).
 */
export function buildStoryConsensus(input: StoryConsensusInput): StoryConsensusReport {
  const { clusterId, title, articles } = input;
  const alignedGroups = alignClaimsAcrossArticles(articles);
  const { items: omittedContext, omittedGroupIds } = detectCrossArticleOmittedContext(
    articles,
    alignedGroups,
  );

  const scores = calculateConsensusScores(articles, alignedGroups);
  const sourceAgreementMap = buildSourceAgreementMap(articles, alignedGroups, omittedGroupIds);

  const sourceCount = new Set(articles.map((a) => a.sourceId)).size;
  const singleSource = articles.length === 1 || sourceCount === 1;
  const overlappingClaims = buildOverlappingClaims(alignedGroups, {
    includeSingleSource: singleSource,
    articles,
  });

  const summary =
    input.summary ??
    (singleSource
      ? `Oscar analyzed 1 article from ${articles[0]?.sourceName ?? "one outlet"}. ` +
        `${overlappingClaims.length} claim(s) extracted, ` +
        `${buildDisputedClaims(alignedGroups).length} flagged as disputed, ` +
        `${omittedContext.length} context gap(s) noted. Cross-source comparison is not available for this story.`
      : `Compared ${articles.length} articles from ${sourceCount} sources. ` +
        `${overlappingClaims.length} overlapping claim(s), ` +
        `${buildDisputedClaims(alignedGroups).length} disputed, ` +
        `${omittedContext.length} context gap(s) identified.`);
  const disputedClaims = buildDisputedClaims(alignedGroups);
  const emotionalFramingDifferences = analyzeEmotionalFraming(articles);
  const narrativeDifferences = analyzeNarrativeDifferences(articles, alignedGroups);

  const reportBody = {
    clusterId,
    title,
    summary,
    articleCount: articles.length,
    sourceCount,
    consensusScore: scores.consensusScore,
    disputeScore: scores.disputeScore,
    uncertaintyScore: scores.uncertaintyScore,
    storyConfidence: scores.storyConfidence,
    overlappingClaims,
    disputedClaims,
    omittedContext,
    emotionalFramingDifferences,
    narrativeDifferences,
  };

  return {
    ...reportBody,
    sourceAgreementMap,
    computedAt: new Date().toISOString(),
    findingsSummary: buildConsensusFindingsSummary(reportBody),
  };
}
