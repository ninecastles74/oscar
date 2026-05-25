import type {
  EmotionalFramingDifference,
  NarrativeDifference,
  OmittedContextItem,
} from "@/types/news-platform";
import type { AnalyzedArticleBundle } from "@/server/consensus/types";

export type FramingSignalCategory =
  | "emotional"
  | "sensational"
  | "fear"
  | "certainty"
  | "polarization";

export interface FramingTextSignals {
  categoryScores: Record<FramingSignalCategory, number>;
  emotionalLanguageScore: number;
  sensationalismScore: number;
  framingIntensityScore: number;
  neutralityScore: number;
  examples: string[];
  hasBalancingLanguage: boolean;
  hasHedging: boolean;
}

export type FramingDetectionType =
  | "emotional_language"
  | "sensationalism"
  | "fear_framing"
  | "certainty_exaggeration"
  | "narrative_polarization"
  | "cross_organization_framing"
  | "omitted_balancing_perspective";

export interface FramingDetectionFinding {
  type: FramingDetectionType;
  severity: "info" | "warning" | "critical";
  description: string;
  sourceIds: string[];
  examples: string[];
}

export interface OrganizationFramingProfile {
  sourceId: string;
  sourceName: string;
  dominantTone: string;
  emotionalLanguageScore: number;
  sensationalismScore: number;
  framingIntensityScore: number;
  neutralityScore: number;
  categoryScores: Record<FramingSignalCategory, number>;
  hasBalancingLanguage: boolean;
  hasHedging: boolean;
  examples: string[];
}

export interface NarrativeFramingIntelligenceReport {
  sensationalismScore: number;
  framingIntensityScore: number;
  emotionalLanguageScore: number;
  neutralityScore: number;
  detections: FramingDetectionFinding[];
  organizationProfiles: OrganizationFramingProfile[];
  emotionalFramingDifferences: EmotionalFramingDifference[];
  narrativeDifferences: NarrativeDifference[];
  omittedBalancingPerspectives: OmittedBalancingPerspective[];
  sourceCount: number;
  articleCount: number;
  computedAt: string;
}

export interface OmittedBalancingPerspective {
  description: string;
  affectedSourceIds: string[];
  relatedOmittedContext?: OmittedContextItem[];
  severity: "info" | "warning" | "critical";
}

export interface NarrativeFramingIntelligenceInput {
  articles: AnalyzedArticleBundle[];
}
