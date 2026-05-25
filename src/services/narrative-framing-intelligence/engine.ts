import { buildNarrativeFramingIntelligenceReport } from "@/server/framing-intelligence";
import type {
  NarrativeFramingIntelligenceInput,
  NarrativeFramingIntelligenceJson,
} from "./types";

/**
 * Narrative & Framing Intelligence Engine
 *
 * Detects emotional language, sensationalism, fear framing, certainty exaggeration,
 * narrative polarization, cross-organization framing differences, and omitted
 * balancing perspectives. Returns structured JSON only.
 */
export function runNarrativeFramingIntelligence(
  input: NarrativeFramingIntelligenceInput,
): NarrativeFramingIntelligenceJson {
  const report = buildNarrativeFramingIntelligenceReport(input);
  return {
    sensationalismScore: report.sensationalismScore,
    framingIntensityScore: report.framingIntensityScore,
    emotionalLanguageScore: report.emotionalLanguageScore,
    neutralityScore: report.neutralityScore,
    detections: report.detections,
    organizationProfiles: report.organizationProfiles,
    emotionalFramingDifferences: report.emotionalFramingDifferences,
    narrativeDifferences: report.narrativeDifferences,
    omittedBalancingPerspectives: report.omittedBalancingPerspectives,
    sourceCount: report.sourceCount,
    articleCount: report.articleCount,
    computedAt: report.computedAt,
  };
}

export function runNarrativeFramingIntelligenceBatch(
  inputs: NarrativeFramingIntelligenceInput[],
): NarrativeFramingIntelligenceJson[] {
  return inputs.map(runNarrativeFramingIntelligence);
}
