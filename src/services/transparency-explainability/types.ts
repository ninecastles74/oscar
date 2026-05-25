import type {
  AnalysisExplainabilityBundle,
  ScoreExplainability,
  StoryConsensusReport,
  TransparencyExplainabilityBundle,
} from "@/types/news-platform";
import type { BuildTransparencyBundleInput } from "@/server/transparency-explainability/build-bundle";
import type { StoryConsensusIntelligenceReport } from "@/server/consensus/story-intelligence";

export type { BuildTransparencyBundleInput, TransparencyExplainabilityBundle, ScoreExplainability };

export interface StoryTransparencyInput {
  report: StoryConsensusReport;
  intelligence?: StoryConsensusIntelligenceReport;
}

export interface FullTransparencyInput extends BuildTransparencyBundleInput {}
