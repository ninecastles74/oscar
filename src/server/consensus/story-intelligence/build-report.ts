import { alignClaimsAcrossArticles } from "../claim-alignment";
import { detectCrossArticleOmittedContext } from "../omitted-context";
import { buildSourceAgreementMap } from "../source-agreement-map";
import { calculateConsensusScores } from "../score-calculator";
import type { StoryConsensusInput } from "../types";
import { buildStoryIntelligenceDetections } from "./detections";
import { computeEvidenceDensityScore } from "./evidence-density";
import type { StoryConsensusIntelligenceReport } from "./types";

/**
 * Story Consensus Intelligence Layer — compares all reporting on the same event,
 * surfaces overlaps, disputes, evolving narratives, missing evidence, and emerging
 * contradictions; returns story-level scores (not objective truth).
 */
export function buildStoryConsensusIntelligence(
  input: StoryConsensusInput,
): StoryConsensusIntelligenceReport {
  const { clusterId, title, articles } = input;
  const alignedGroups = alignClaimsAcrossArticles(articles);
  const { omittedGroupIds } = detectCrossArticleOmittedContext(articles, alignedGroups);
  const scores = calculateConsensusScores(articles, alignedGroups);
  const sourceAgreementMap = buildSourceAgreementMap(articles, alignedGroups, omittedGroupIds);
  const detections = buildStoryIntelligenceDetections(articles, alignedGroups, omittedGroupIds);
  const evidenceDensityScore = computeEvidenceDensityScore(articles, alignedGroups);
  const sourceCount = new Set(articles.map((a) => a.sourceId)).size;

  return {
    consensusScore: scores.consensusScore,
    disputeScore: scores.disputeScore,
    uncertaintyScore: scores.uncertaintyScore,
    sourceAgreementMap,
    evidenceDensityScore,
    storyConfidence: scores.storyConfidence,
    overlappingClaims: detections.overlappingClaims,
    disputedClaims: detections.disputedClaims,
    evolvingNarratives: detections.evolvingNarratives,
    missingEvidence: detections.missingEvidence,
    emergingContradictions: detections.emergingContradictions,
    clusterId,
    title,
    articleCount: articles.length,
    sourceCount,
    computedAt: new Date().toISOString(),
  };
}
