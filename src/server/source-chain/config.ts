import { APPROVED_SOURCES } from "../analysis/sources";

/** Wire services treated as upstream propagation roots. */
export const WIRE_SOURCE_IDS = new Set(["s1", "s2"]);

export const WIRE_NAMES: Record<string, string> = {
  s1: "Reuters",
  s2: "Associated Press",
};

const CITATION_PREFIX =
  /\b(?:according to|reported by|per |via |citing |quoted (?:in|by)|as reported (?:by|in)|sources (?:told|said)|exclusive to)\s+/i;

export const CITATION_PATTERNS = [
  { relationship: "cites" as const, re: /\baccording to\s+([^.]+)/i },
  { relationship: "cites" as const, re: /\breported by\s+([^.]+)/i },
  { relationship: "paraphrases" as const, re: /\bper\s+([^.]+)/i },
  { relationship: "cites" as const, re: /\bciting\s+([^.]+)/i },
  { relationship: "wire_propagation" as const, re: /\bvia\s+(reuters|associated press|ap)\b/i },
  { relationship: "wire_propagation" as const, re: /\bfrom\s+(reuters|associated press|ap)\b/i },
];

export function sourceNameIndex(): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of APPROVED_SOURCES) {
    m.set(s.id, s.name);
    m.set(s.name.toLowerCase(), s.id);
    const short = s.name.split(" ")[0]?.toLowerCase();
    if (short && short.length > 3) m.set(short, s.id);
  }
  m.set("reuters", "s1");
  m.set("ap", "s2");
  m.set("associated press", "s2");
  return m;
}

export function resolveSourceId(fragment: string, index: Map<string, string>): string | null {
  const lower = fragment.toLowerCase().trim();
  for (const [key, id] of index) {
    if (lower.includes(key) && key.length > 2) return id;
  }
  return null;
}

export function hasCitationLanguage(excerpt: string): boolean {
  return CITATION_PREFIX.test(excerpt);
}
