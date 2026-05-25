export interface FramingMarker {
  category: "emotional" | "sensational" | "fear" | "certainty" | "polarization";
  label: string;
  pattern: RegExp;
  weight: number;
}

export const FRAMING_MARKERS: FramingMarker[] = [
  // Emotionally loaded wording
  { category: "emotional", label: "outrage", pattern: /\b(outrageous|fury|furious|slams|blasts|condemns|eviscerates|vilified)\b/gi, weight: 3 },
  { category: "emotional", label: "loaded", pattern: /\b(disgrace|shameful|heartbreaking|tragic|appalling|abhorrent)\b/gi, weight: 2 },
  { category: "emotional", label: "praise", pattern: /\b(heroic|triumphant|glorious|stunning victory|beloved)\b/gi, weight: 2 },

  // Sensationalism
  { category: "sensational", label: "hyperbolic", pattern: /\b(bombshell|shocking|explosive|blockbuster|meltdown|game.?changer)\b/gi, weight: 3 },
  { category: "sensational", label: "superlative", pattern: /\b(worst ever|never before|unprecedented|historic collapse|skyrocket|plummet)\b/gi, weight: 3 },
  { category: "sensational", label: "clickbait", pattern: /\b(you won'?t believe|must see|jaw.?dropping|secret revealed|exposed)\b/gi, weight: 2 },

  // Fear-based framing
  { category: "fear", label: "threat", pattern: /\b(terror|terrifying|nightmare|doom|dread|impending doom|existential threat)\b/gi, weight: 3 },
  { category: "fear", label: "alarm", pattern: /\b(panic|chaos|crisis|catastroph|horrific|devastating|on the brink)\b/gi, weight: 3 },
  { category: "fear", label: "danger", pattern: /\b(deadly|lethal|peril|imminent danger|spiraling out of control)\b/gi, weight: 2 },

  // Certainty exaggeration (absolute claims without hedging)
  { category: "certainty", label: "absolute", pattern: /\b(proves?|undeniable|without doubt|definitely|certainly|guaranteed|irrefutable)\b/gi, weight: 3 },
  { category: "certainty", label: "always_never", pattern: /\b(always|never|every single|no question|conclusive proof)\b/gi, weight: 2 },
  { category: "certainty", label: "consensus_claim", pattern: /\b(everyone knows|the whole world|universally|settled science|beyond debate)\b/gi, weight: 2 },

  // Narrative polarization
  { category: "polarization", label: "partisan", pattern: /\b(radical left|radical right|woke mob|culture war|enemy of the people|witch hunt)\b/gi, weight: 3 },
  { category: "polarization", label: "us_them", pattern: /\b(they want to|the other side|true patriots|elites vs|us versus them)\b/gi, weight: 2 },
  { category: "polarization", label: "moralized", pattern: /\b(traitor|evil|corrupt cabal|destroying our|weaponized)\b/gi, weight: 2 },
];

const HEDGE_PATTERN =
  /\b(may|might|could|possibly|reportedly|allegedly|appears|suggests|preliminary|unclear|uncertain)\b/gi;

const BALANCING_PATTERN =
  /\b(however|although|critics|supporters|opponents|proponents|both sides|on the other hand|some argue|others say|disagree|debate continues)\b/gi;

export function hasHedgingLanguage(text: string): boolean {
  return HEDGE_PATTERN.test(text);
}

export function hasBalancingPerspective(text: string): boolean {
  return BALANCING_PATTERN.test(text);
}
