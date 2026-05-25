import { APPROVED_SOURCES } from "../analysis/sources";

const BLOCKED_EXACT = new Set(
  [
    ...APPROVED_SOURCES.map((s) => s.name.trim().toLowerCase()),
    "reuters",
    "associated press",
    "ap",
    "agence france-presse",
    "afp",
    "bloomberg news",
    "bbc",
    "bbc news",
    "cnn",
    "fox news",
    "npr",
    "staff",
    "staff writer",
    "editorial board",
    "editorial",
    "admin",
    "newsroom",
    "desk",
    "wire services",
    "press association",
  ].map((s) => s.toLowerCase()),
);

const BLOCKED_SUBSTRINGS = [
  " news",
  " times",
  " post",
  " journal",
  " tribune",
  " herald",
  " gazette",
  " magazine",
  " network",
  " television",
  " radio",
  " newsroom",
  " staff",
  " editorial",
  " desk",
  " breaking news",
  " world news",
  " politics team",
];

function normalize(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** True when a feed byline looks like a person, not a publisher or wire service. */
export function isValidAuthorByline(name: string, outletName?: string): boolean {
  const text = normalize(name);
  if (!text || text.length < 3) return false;
  if (text.length > 80) return false;
  if (text.includes("@") && !text.includes(" ")) return false;

  const lower = text.toLowerCase();
  if (BLOCKED_EXACT.has(lower)) return false;
  if (outletName && lower === outletName.trim().toLowerCase()) return false;

  for (const sub of BLOCKED_SUBSTRINGS) {
    if (lower.includes(sub)) return false;
  }

  // "Reuters Staff" / "AP News"
  if (/\b(reuters|associated press|bloomberg|cnn|bbc|npr|fox news)\b/i.test(text)) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  // Require at least one token that looks like a name (not all-caps acronym)
  const hasNameLike = words.some((w) => /^[A-Za-z][a-z]+/.test(w) || /^[A-Z][a-z]+$/.test(w));
  if (!hasNameLike && words.every((w) => w === w.toUpperCase() && w.length <= 4)) {
    return false;
  }

  return true;
}
