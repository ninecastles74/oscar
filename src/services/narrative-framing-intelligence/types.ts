import type { NarrativeFramingIntelligenceReport } from "@/server/framing-intelligence/types";
import type { AnalyzedArticleBundle } from "@/server/consensus/types";

export interface NarrativeFramingIntelligenceInput {
  articles: AnalyzedArticleBundle[];
}

/** Structured JSON from the Narrative & Framing Intelligence Engine. */
export interface NarrativeFramingIntelligenceJson
  extends Pick<
    NarrativeFramingIntelligenceReport,
    | "sensationalismScore"
    | "framingIntensityScore"
    | "emotionalLanguageScore"
    | "neutralityScore"
    | "detections"
    | "organizationProfiles"
    | "emotionalFramingDifferences"
    | "narrativeDifferences"
    | "omittedBalancingPerspectives"
    | "sourceCount"
    | "articleCount"
    | "computedAt"
  > {}

export type { AnalyzedArticleBundle, NarrativeFramingIntelligenceReport };
