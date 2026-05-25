import type {
  AnalysisReport,
  ReliabilityScoreBundle,
  StoryConsensusReport,
  TransparencyExplainabilityBundle,
} from "@/types/news-platform";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import type { StoryConsensusIntelligenceReport } from "../consensus/story-intelligence/types";
import { buildStoryScoreExplainability } from "./build-story-explainability";

export interface BuildTransparencyBundleInput {
  report: AnalysisReport;
  bundle: ReliabilityScoreBundle;
  results?: VerificationPipelineResults;
  storyReport?: StoryConsensusReport | null;
  storyIntelligence?: StoryConsensusIntelligenceReport;
}

/**
 * Transparency & Explainability Layer — unified explainability for article,
 * source, author, and story scores.
 */
export function buildTransparencyExplainabilityBundle(
  input: BuildTransparencyBundleInput,
): TransparencyExplainabilityBundle {
  const base = buildFullExplainabilityBundle(input.report, input.bundle, input.results);
  const story = input.storyReport
    ? buildStoryScoreExplainability(input.storyReport, input.storyIntelligence)
    : null;

  return {
    ...base,
    story,
  };
}
