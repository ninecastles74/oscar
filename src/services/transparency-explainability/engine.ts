import { buildStoryConsensusIntelligence } from "@/server/consensus/story-intelligence";
import { buildTransparencyExplainabilityBundle } from "@/server/transparency-explainability";
import { buildStoryScoreExplainability } from "@/server/transparency-explainability/build-story-explainability";
import type { StoryConsensusInput } from "@/server/consensus/types";
import type {
  FullTransparencyInput,
  StoryTransparencyInput,
  TransparencyExplainabilityBundle,
} from "./types";
import type { ScoreExplainability } from "@/types/news-platform";

/**
 * Transparency & Explainability Layer (service facade)
 *
 * Every article, source, author, and story score includes supporting/disputed
 * evidence, contradiction and omitted-context explanations, corroborating sources,
 * confidence reasoning, historical changes, and AI summaries.
 */
export function runTransparencyExplainability(
  input: FullTransparencyInput,
): TransparencyExplainabilityBundle {
  return buildTransparencyExplainabilityBundle(input);
}

export function runStoryTransparencyExplainability(
  input: StoryTransparencyInput,
): ScoreExplainability {
  return buildStoryScoreExplainability(input.report, input.intelligence);
}

export function runStoryTransparencyFromConsensusInput(
  consensusInput: StoryConsensusInput,
  storyReport?: import("@/types/news-platform").StoryConsensusReport,
): ScoreExplainability {
  const intelligence = buildStoryConsensusIntelligence(consensusInput);
  const report =
    storyReport ??
    ({
      clusterId: consensusInput.clusterId,
      title: consensusInput.title,
      summary: consensusInput.summary ?? "",
      articleCount: consensusInput.articles.length,
      sourceCount: new Set(consensusInput.articles.map((a) => a.sourceId)).size,
      consensusScore: intelligence.consensusScore,
      disputeScore: intelligence.disputeScore,
      uncertaintyScore: intelligence.uncertaintyScore,
      storyConfidence: intelligence.storyConfidence,
      overlappingClaims: intelligence.overlappingClaims,
      disputedClaims: intelligence.disputedClaims,
      omittedContext: intelligence.missingEvidence.map((m) => ({
        claimText: m.claimText,
        description: m.description,
        severity: m.severity,
        presentInArticleIds: m.presentInArticleIds,
        missingFromArticleIds: m.missingFromArticleIds,
      })),
      emotionalFramingDifferences: [],
      narrativeDifferences: [],
      sourceAgreementMap: intelligence.sourceAgreementMap,
      computedAt: intelligence.computedAt,
    } satisfies import("@/types/news-platform").StoryConsensusReport);

  return buildStoryScoreExplainability(report, intelligence);
}
