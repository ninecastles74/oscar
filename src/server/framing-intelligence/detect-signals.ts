import { FRAMING_MARKERS, hasBalancingPerspective, hasHedgingLanguage } from "./markers";
import type { FramingSignalCategory, FramingTextSignals } from "./types";

function scoreCategory(
  text: string,
  category: FramingSignalCategory,
): { score: number; examples: string[]; labels: string[] } {
  const examples: string[] = [];
  const labels: string[] = [];
  let score = 0;

  for (const marker of FRAMING_MARKERS) {
    if (marker.category !== category) continue;
    const matches = text.match(marker.pattern) ?? [];
    if (matches.length === 0) continue;
    labels.push(marker.label);
    score += Math.min(40, matches.length * marker.weight * 7);
    for (const m of matches.slice(0, 3)) {
      examples.push(m.toLowerCase());
    }
  }

  if (category === "certainty" && score > 0 && hasHedgingLanguage(text)) {
    score = Math.round(score * 0.55);
  }

  return {
    score: Math.min(100, score),
    examples: [...new Set(examples)].slice(0, 8),
    labels: [...new Set(labels)],
  };
}

export function analyzeTextFramingSignals(text: string): FramingTextSignals {
  const slice = text.slice(0, 8000);
  const emotional = scoreCategory(slice, "emotional");
  const sensational = scoreCategory(slice, "sensational");
  const fear = scoreCategory(slice, "fear");
  const certainty = scoreCategory(slice, "certainty");
  const polarization = scoreCategory(slice, "polarization");

  const categoryScores = {
    emotional: emotional.score,
    sensational: sensational.score,
    fear: fear.score,
    certainty: certainty.score,
    polarization: polarization.score,
  };

  const peak = Math.max(...Object.values(categoryScores), 0);
  const emotionalLanguageScore = Math.min(
    100,
    Math.round(categoryScores.emotional * 0.45 + categoryScores.fear * 0.35 + peak * 0.2),
  );
  const sensationalismScore = Math.min(
    100,
    Math.round(categoryScores.sensational * 0.7 + categoryScores.certainty * 0.15 + peak * 0.15),
  );
  const framingIntensityScore = Math.min(
    100,
    Math.round(
      peak * 0.35 +
        categoryScores.sensational * 0.25 +
        categoryScores.fear * 0.2 +
        categoryScores.polarization * 0.2,
    ),
  );

  const riskAverage =
    (emotionalLanguageScore + sensationalismScore + framingIntensityScore + categoryScores.polarization) /
    4;
  const neutralityScore = Math.max(0, Math.min(100, Math.round(100 - riskAverage)));

  return {
    categoryScores,
    emotionalLanguageScore,
    sensationalismScore,
    framingIntensityScore,
    neutralityScore,
    examples: [
      ...emotional.examples,
      ...sensational.examples,
      ...fear.examples,
      ...certainty.examples,
      ...polarization.examples,
    ].slice(0, 12),
    hasBalancingLanguage: hasBalancingPerspective(slice),
    hasHedging: hasHedgingLanguage(slice),
  };
}
