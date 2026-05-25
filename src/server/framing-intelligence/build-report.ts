import { alignClaimsAcrossArticles } from "@/server/consensus/claim-alignment";
import { analyzeNarrativeDifferences } from "@/server/consensus/narrative-analysis";
import { detectOmittedBalancingPerspectives } from "./balancing-perspectives";
import { buildOrganizationFramingProfiles, detectCrossOrganizationFraming } from "./cross-organization";
import type {
  FramingDetectionFinding,
  NarrativeFramingIntelligenceInput,
  NarrativeFramingIntelligenceReport,
} from "./types";

function buildCategoryDetections(
  profiles: ReturnType<typeof buildOrganizationFramingProfiles>,
): FramingDetectionFinding[] {
  const findings: FramingDetectionFinding[] = [];
  for (const profile of profiles) {
    if (profile.emotionalLanguageScore >= 30) {
      findings.push({
        type: "emotional_language",
        severity: profile.emotionalLanguageScore >= 60 ? "critical" : "warning",
        description: `${profile.sourceName}: elevated emotionally loaded wording.`,
        sourceIds: [profile.sourceId],
        examples: profile.examples.slice(0, 4),
      });
    }

    if (profile.sensationalismScore >= 28) {
      findings.push({
        type: "sensationalism",
        severity: profile.sensationalismScore >= 55 ? "critical" : "warning",
        description: `${profile.sourceName}: sensationalism detected.`,
        sourceIds: [profile.sourceId],
        examples: profile.examples.slice(0, 4),
      });
    }

    if (profile.categoryScores.fear >= 25) {
      findings.push({
        type: "fear_framing",
        severity: profile.categoryScores.fear >= 50 ? "critical" : "warning",
        description: `${profile.sourceName}: fear-based or alarmist framing.`,
        sourceIds: [profile.sourceId],
        examples: profile.examples.slice(0, 4),
      });
    }

    if (profile.categoryScores.certainty >= 22 && !profile.hasHedging) {
      findings.push({
        type: "certainty_exaggeration",
        severity: profile.categoryScores.certainty >= 45 ? "warning" : "info",
        description: `${profile.sourceName}: absolute or overstated certainty without hedging.`,
        sourceIds: [profile.sourceId],
        examples: profile.examples.slice(0, 4),
      });
    }

    if (profile.categoryScores.polarization >= 22) {
      findings.push({
        type: "narrative_polarization",
        severity: profile.categoryScores.polarization >= 45 ? "critical" : "warning",
        description: `${profile.sourceName}: narrative polarization cues in coverage.`,
        sourceIds: [profile.sourceId],
        examples: profile.examples.slice(0, 4),
      });
    }
  }

  return findings;
}

function aggregateScores(
  profiles: ReturnType<typeof buildOrganizationFramingProfiles>,
): Pick<
  NarrativeFramingIntelligenceReport,
  "sensationalismScore" | "framingIntensityScore" | "emotionalLanguageScore" | "neutralityScore"
> {
  if (!profiles.length) {
    return {
      sensationalismScore: 0,
      framingIntensityScore: 0,
      emotionalLanguageScore: 0,
      neutralityScore: 100,
    };
  }

  const avg = (fn: (p: (typeof profiles)[0]) => number) =>
    Math.round(profiles.reduce((s, p) => s + fn(p), 0) / profiles.length);
  const max = (fn: (p: (typeof profiles)[0]) => number) =>
    Math.max(...profiles.map(fn), 0);

  const sensationalismScore = Math.min(100, Math.round(avg((p) => p.sensationalismScore) * 0.5 + max((p) => p.sensationalismScore) * 0.5));
  const emotionalLanguageScore = Math.min(100, Math.round(avg((p) => p.emotionalLanguageScore) * 0.5 + max((p) => p.emotionalLanguageScore) * 0.5));
  const framingIntensityScore = Math.min(100, Math.round(avg((p) => p.framingIntensityScore) * 0.45 + max((p) => p.framingIntensityScore) * 0.55));
  const neutralityScore = Math.max(0, Math.min(100, Math.round(profiles.reduce((s, p) => s + p.neutralityScore, 0) / profiles.length)));

  return { sensationalismScore, framingIntensityScore, emotionalLanguageScore, neutralityScore };
}

/**
 * Narrative & Framing Intelligence Engine — multi-outlet framing analysis.
 */
export function buildNarrativeFramingIntelligenceReport(
  input: NarrativeFramingIntelligenceInput,
): NarrativeFramingIntelligenceReport {
  const { articles } = input;
  const profiles = buildOrganizationFramingProfiles(articles);
  const scores = aggregateScores(profiles);

  const alignedGroups = alignClaimsAcrossArticles(articles);
  const narrativeDifferences = analyzeNarrativeDifferences(articles, alignedGroups);
  const { findings: crossFindings, emotionalFramingDifferences } = detectCrossOrganizationFraming(
    articles,
    profiles,
  );
  const { omitted: omittedBalancingPerspectives, findings: balanceFindings } =
    detectOmittedBalancingPerspectives(articles);

  const detections = [
    ...buildCategoryDetections(profiles),
    ...crossFindings,
    ...balanceFindings,
  ];

  return {
    ...scores,
    detections,
    organizationProfiles: profiles,
    emotionalFramingDifferences,
    narrativeDifferences,
    omittedBalancingPerspectives,
    sourceCount: new Set(articles.map((a) => a.sourceId)).size,
    articleCount: articles.length,
    computedAt: new Date().toISOString(),
  };
}
