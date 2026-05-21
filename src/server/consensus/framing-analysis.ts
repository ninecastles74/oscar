import type { EmotionalFramingDifference } from "@/types/news-platform";
import type { AnalyzedArticleBundle } from "./types";

const EMOTIONAL_MARKERS: { tone: string; pattern: RegExp; weight: number }[] = [
  { tone: "alarmist", pattern: /\b(shocking|horrific|devastating|crisis|catastroph|chaos|panic)\b/gi, weight: 3 },
  { tone: "outrage", pattern: /\b(outrageous|slams|blasts|fury|backlash|condemns)\b/gi, weight: 2 },
  { tone: "optimistic", pattern: /\b(breakthrough|hope|recovery|surge|milestone|success)\b/gi, weight: 2 },
  { tone: "cautious", pattern: /\b(may|might|could|unclear|uncertain|preliminary|alleged)\b/gi, weight: 1 },
  { tone: "neutral", pattern: /\b(reported|according|said|announced|data|official)\b/gi, weight: 1 },
];

function scoreFraming(text: string): Record<string, { score: number; examples: string[] }> {
  const scores: Record<string, { score: number; examples: string[] }> = {};
  for (const { tone, pattern, weight } of EMOTIONAL_MARKERS) {
    const matches = text.match(pattern) ?? [];
    if (matches.length > 0) {
      scores[tone] = {
        score: Math.min(100, matches.length * weight * 8),
        examples: [...new Set(matches.map((m) => m.toLowerCase()))].slice(0, 4),
      };
    }
  }
  if (Object.keys(scores).length === 0) {
    scores.neutral = { score: 40, examples: ["factual reporting tone"] };
  }
  return scores;
}

function dominantTone(framing: Record<string, { score: number }>): string {
  let best = "neutral";
  let max = 0;
  for (const [tone, { score }] of Object.entries(framing)) {
    if (score > max) {
      max = score;
      best = tone;
    }
  }
  return best;
}

export function analyzeEmotionalFraming(
  articles: AnalyzedArticleBundle[],
): EmotionalFramingDifference[] {
  const bySource: Record<string, ReturnType<typeof scoreFraming>> = {};
  for (const art of articles) {
    const text = `${art.title} ${art.analysisText}`.slice(0, 4000);
    bySource[art.sourceId] = scoreFraming(text);
  }

  const tones = articles.map((a) => ({
    sourceId: a.sourceId,
    tone: dominantTone(bySource[a.sourceId]),
    framing: bySource[a.sourceId],
  }));

  const uniqueTones = new Set(tones.map((t) => t.tone));
  if (uniqueTones.size <= 1) {
    return [
      {
        aspect: "emotional_tone",
        description: "Outlets use similar emotional framing across coverage.",
        bySource: Object.fromEntries(
          tones.map((t) => [
            t.sourceId,
            {
              tone: t.tone,
              score: t.framing[t.tone]?.score ?? 40,
              examples: t.framing[t.tone]?.examples ?? [],
            },
          ]),
        ),
      },
    ];
  }

  const bySourceOut: EmotionalFramingDifference["bySource"] = {};
  for (const t of tones) {
    const f = t.framing[t.tone] ?? { score: 40, examples: [] };
    bySourceOut[t.sourceId] = { tone: t.tone, score: f.score, examples: f.examples };
  }

  return [
    {
      aspect: "emotional_tone",
      description: `Sources diverge in emotional framing (${[...uniqueTones].join(" vs ")}). This affects how readers interpret the same underlying facts.`,
      bySource: bySourceOut,
    },
  ];
}
