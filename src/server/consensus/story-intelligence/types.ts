import type { SourceAgreementMap } from "@/types/news-platform";
import type { StoryConsensusInput } from "../types";
import type {
  EmergingContradictionFinding,
  EvolvingNarrativeFinding,
  MissingEvidenceFinding,
  StoryIntelligenceDetections,
} from "./detections";

export interface StoryConsensusIntelligenceReport {
  consensusScore: number;
  disputeScore: number;
  uncertaintyScore: number;
  sourceAgreementMap: SourceAgreementMap;
  evidenceDensityScore: number;
  storyConfidence: number;
  overlappingClaims: StoryIntelligenceDetections["overlappingClaims"];
  disputedClaims: StoryIntelligenceDetections["disputedClaims"];
  evolvingNarratives: EvolvingNarrativeFinding[];
  missingEvidence: MissingEvidenceFinding[];
  emergingContradictions: EmergingContradictionFinding[];
  clusterId: string;
  title: string;
  articleCount: number;
  sourceCount: number;
  computedAt: string;
}

export type { StoryConsensusInput };
