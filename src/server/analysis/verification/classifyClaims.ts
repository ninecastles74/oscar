import type { ClassifiedClaim, ExtractedClaim } from "./types";

function detectKind(text: string): ClassifiedClaim["kind"] {
  const lower = text.toLowerCase();
  if (/\d+%|\d+\s*(million|billion|thousand)|\$\d/.test(lower)) return "statistical";
  if (/\b(said|says|according to|told|wrote|posted)\b/.test(lower)) return "attribution";
  if (/\b(will|expected to|forecast|predict|likely to)\b/.test(lower)) return "prediction";
  if (/\b(should|must|ought|believe|think|best|worst|shameful|brilliant)\b/.test(lower))
    return "opinion";
  if (/\b(file|bill|law|regulation|court|ruled|hearing)\b/.test(lower)) return "procedural";
  return "factual";
}

/**
 * 2. classifyClaims — tag claim type; only factual/statistical/attribution are fully verified.
 */
export function classifyClaims(claims: ExtractedClaim[]): ClassifiedClaim[] {
  return claims.map((claim) => {
    const kind = detectKind(claim.text);
    const verifiable = kind === "factual" || kind === "statistical" || kind === "attribution";
    return { ...claim, kind, verifiable };
  });
}
