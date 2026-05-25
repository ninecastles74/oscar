import type { StoryConsensusJson, StoryConsensusSummaryJson } from "./types";

export function summarizeStoryConsensus(report: StoryConsensusJson): StoryConsensusSummaryJson {
  return {
    clusterId: report.clusterId,
    title: report.title,
    consensusScore: report.consensusScore,
    disputeScore: report.disputeScore,
    uncertaintyScore: report.uncertaintyScore,
    storyConfidence: report.storyConfidence,
    articleCount: report.articleCount,
    sourceCount: report.sourceCount,
    overlappingClaimCount: report.overlappingClaims.length,
    disputedClaimCount: report.disputedClaims.length,
    omittedContextCount: report.omittedContext.length,
    computedAt: report.computedAt,
  };
}
