import type {
  ContradictionIssue,
  EmotionalExaggerationFinding,
  EvidenceItem,
} from "@/types/news-platform";
import type { PeerArticleSlice } from "./types";

const EMOTIONAL_MARKERS: { tone: string; pattern: RegExp; weight: number }[] = [
  { tone: "alarmist", pattern: /\b(shocking|horrific|devastating|catastroph|disaster|chaos|panic|explosive|skyrocket|plummet)\b/gi, weight: 3 },
  { tone: "outrage", pattern: /\b(outrageous|slams|blasts|fury|backlash|condemns|eviscerates|destroyed)\b/gi, weight: 3 },
  { tone: "hyperbolic", pattern: /\b(worst ever|never before|unprecedented|game.?changer|bombshell|meltdown)\b/gi, weight: 2 },
  { tone: "loaded", pattern: /\b(radical|extreme|dangerous|corrupt|evil|traitor|witch hunt)\b/gi, weight: 2 },
];

function scoreTextIntensity(text: string): {
  intensity: number;
  tones: string[];
  examples: string[];
} {
  const tones: string[] = [];
  const examples: string[] = [];
  let intensity = 0;

  for (const { tone, pattern, weight } of EMOTIONAL_MARKERS) {
    const matches = text.match(pattern) ?? [];
    if (matches.length > 0) {
      tones.push(tone);
      intensity += Math.min(35, matches.length * weight * 6);
      for (const m of matches.slice(0, 2)) {
        examples.push(m.toLowerCase());
      }
    }
  }

  return {
    intensity: Math.min(100, intensity),
    tones: [...new Set(tones)],
    examples: [...new Set(examples)].slice(0, 6),
  };
}

export function detectEmotionalExaggeration(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
  peerArticles?: PeerArticleSlice[],
): { findings: EmotionalExaggerationFinding[]; issues: ContradictionIssue[]; framingIntensityScore: number } {
  const findings: EmotionalExaggerationFinding[] = [];
  const issues: ContradictionIssue[] = [];

  const claimScore = scoreTextIntensity(claimText);
  const evidenceScores = evidence.map((e) => ({
    sourceId: e.sourceId,
    ...scoreTextIntensity(e.excerpt),
  }));

  const peerScores =
    peerArticles?.map((a) => ({
      sourceId: a.sourceId,
      ...scoreTextIntensity(`${a.title} ${a.text}`),
    })) ?? [];

  const allScores = [claimScore, ...evidenceScores, ...peerScores];
  const framingIntensityScore = Math.round(
    Math.max(...allScores.map((s) => s.intensity), 0),
  );

  if (framingIntensityScore >= 25) {
    const dominantTones = [...new Set(allScores.flatMap((s) => s.tones))];
    const markerExamples = [...new Set(allScores.flatMap((s) => s.examples))].slice(0, 6);
    const sourceIds = [
      ...new Set([...evidence.map((e) => e.sourceId), ...(peerArticles?.map((a) => a.sourceId) ?? [])]),
    ];

    const severity: "info" | "warning" | "critical" =
      framingIntensityScore >= 65 ? "critical" : framingIntensityScore >= 40 ? "warning" : "info";

    const description =
      severity === "critical"
        ? "Highly emotional or exaggerated framing may distort factual interpretation."
        : severity === "warning"
          ? "Elevated emotional language detected in claim or coverage excerpts."
          : "Mild emotional framing present in claim or excerpts.";

    findings.push({
      claimId,
      intensityScore: framingIntensityScore,
      dominantTones,
      markerExamples,
      description,
      sourceIds: sourceIds.slice(0, 8),
      severity,
    });

    issues.push({
      issueId: `${claimId}_framing`,
      type: "emotional_exaggeration",
      claimId,
      description,
      severity: severity === "critical" ? "critical" : "warning",
      evidenceIds: evidence.map((e) => e.id).slice(0, 3),
    });
  }

  return { findings, issues, framingIntensityScore };
}
