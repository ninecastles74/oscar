import { analyzeEmotionalFraming } from "@/server/consensus/framing-analysis";
import type { AnalyzedArticleBundle } from "@/server/consensus/types";
import type { FramingDetectionFinding, OrganizationFramingProfile } from "./types";
import { analyzeTextFramingSignals } from "./detect-signals";

function dominantToneFromScores(signals: ReturnType<typeof analyzeTextFramingSignals>): string {
  const entries = Object.entries(signals.categoryScores) as [string, number][];
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 12) return "neutral";
  if (top[0] === "fear") return "fear";
  if (top[0] === "sensational") return "sensational";
  if (top[0] === "polarization") return "polarized";
  if (top[0] === "certainty") return "certainty-heavy";
  return "emotional";
}

export function buildOrganizationFramingProfiles(
  articles: AnalyzedArticleBundle[],
): OrganizationFramingProfile[] {
  return articles.map((art) => {
    const text = `${art.title} ${art.analysisText}`;
    const signals = analyzeTextFramingSignals(text);
    return {
      sourceId: art.sourceId,
      sourceName: art.sourceName,
      dominantTone: dominantToneFromScores(signals),
      emotionalLanguageScore: signals.emotionalLanguageScore,
      sensationalismScore: signals.sensationalismScore,
      framingIntensityScore: signals.framingIntensityScore,
      neutralityScore: signals.neutralityScore,
      categoryScores: signals.categoryScores,
      hasBalancingLanguage: signals.hasBalancingLanguage,
      hasHedging: signals.hasHedging,
      examples: signals.examples,
    };
  });
}

export function detectCrossOrganizationFraming(
  articles: AnalyzedArticleBundle[],
  profiles: OrganizationFramingProfile[],
): { findings: FramingDetectionFinding[]; emotionalFramingDifferences: ReturnType<typeof analyzeEmotionalFraming> } {
  const emotionalFramingDifferences = analyzeEmotionalFraming(articles);
  const findings: FramingDetectionFinding[] = [];

  const tones = new Set(profiles.map((p) => p.dominantTone));
  if (tones.size > 1 && !tones.has("neutral") || (tones.size >= 2 && profiles.length >= 2)) {
    const toneList = [...tones].join(" vs ");
    findings.push({
      type: "cross_organization_framing",
      severity: tones.size >= 3 ? "warning" : "info",
      description: `Organizations diverge in dominant framing tone (${toneList}).`,
      sourceIds: profiles.map((p) => p.sourceId),
      examples: profiles.flatMap((p) => p.examples).slice(0, 8),
    });
  }

  const scoreSpread = (key: keyof Pick<OrganizationFramingProfile, "sensationalismScore" | "emotionalLanguageScore" | "framingIntensityScore">) => {
    const vals = profiles.map((p) => p[key]);
    return Math.max(...vals, 0) - Math.min(...vals, 0);
  };

  if (scoreSpread("framingIntensityScore") >= 35 && profiles.length >= 2) {
    findings.push({
      type: "cross_organization_framing",
      severity: "warning",
      description:
        "Framing intensity varies sharply across outlets covering the same event.",
      sourceIds: profiles
        .sort((a, b) => b.framingIntensityScore - a.framingIntensityScore)
        .slice(0, 4)
        .map((p) => p.sourceId),
      examples: [],
    });
  }

  for (const diff of emotionalFramingDifferences) {
    if (diff.aspect !== "emotional_tone") continue;
    const sourceTones = Object.values(diff.bySource ?? {}).map((s) => s.tone);
    if (new Set(sourceTones).size <= 1) continue;
    findings.push({
      type: "cross_organization_framing",
      severity: "info",
      description: diff.description,
      sourceIds: Object.keys(diff.bySource ?? {}),
      examples: Object.values(diff.bySource ?? {})
        .flatMap((s) => s.examples)
        .slice(0, 6),
    });
  }

  return { findings, emotionalFramingDifferences };
}
