import { clampScore } from "@/server/reliability/utils/math";
import type { PrioritizedEvidenceItemJson } from "./types";
import type { EvidencePriorityCategory } from "./types";
import { CATEGORY_TRUST_WEIGHT, EVIDENCE_PRIORITY_CATEGORIES } from "./types";

export function emptyCategoryDistribution(): Record<EvidencePriorityCategory, number> {
  return Object.fromEntries(
    EVIDENCE_PRIORITY_CATEGORIES.map((c) => [c, 0]),
  ) as Record<EvidencePriorityCategory, number>;
}

/** 0–100: strength of evidence types (primary, official, direct) vs weak tiers. */
export function computeEvidenceQualityScore(
  items: PrioritizedEvidenceItemJson[],
): number {
  const supporting = items.filter((i) => i.supports);
  if (supporting.length === 0) return 0;

  const weights = supporting.map((i) => (i.trustWeight + i.dynamicWeight) / 2);
  const top = [...weights].sort((a, b) => b - a);
  const topN = Math.max(1, Math.ceil(top.length * 0.4));
  const avgTop = top.slice(0, topN).reduce((s, w) => s + w, 0) / topN;

  const primaryShare = supporting.filter((i) => i.category === "primary").length / supporting.length;
  const weakShare =
    supporting.filter((i) =>
      ["tertiary", "opinion", "speculative", "anonymous", "unverifiable"].includes(i.category),
    ).length / supporting.length;

  let score = avgTop;
  score += primaryShare * 12;
  score -= weakShare * 28;

  return clampScore(Math.round(score));
}

/** 0–100: confidence that the claim is well-supported by prioritized evidence. */
export function computeEvidenceConfidenceScore(
  items: PrioritizedEvidenceItemJson[],
  supportingCount: number,
): number {
  if (items.length === 0) return 0;

  const supporting = items.filter((i) => i.supports);
  if (supporting.length === 0) return Math.max(0, 15 - items.length * 3);

  const highTrust = supporting.filter((i) => i.category === "primary" || i.category === "secondary").length;
  const corroboration = Math.min(1, highTrust / Math.max(1, supporting.length));
  const diversity = new Set(supporting.map((i) => i.sourceId)).size;

  let score = corroboration * 55 + Math.min(diversity, 4) * 8;
  score += (supportingCount / Math.max(1, items.length)) * 20;

  const unverifiable = supporting.filter((i) => i.category === "unverifiable").length;
  const anonymous = supporting.filter((i) => i.category === "anonymous").length;
  score -= unverifiable * 15;
  score -= anonymous * 10;

  if (supporting.some((i) => i.category === "primary")) score += 10;

  return clampScore(Math.round(score));
}

/** 0–100: how transparent attribution is (named sources, citations, low anonymous chains). */
export function computeSourceTransparencyScore(
  items: PrioritizedEvidenceItemJson[],
): number {
  if (items.length === 0) return 0;

  let score = 70;

  const anonymousCount = items.filter((i) => i.category === "anonymous").length;
  const unverifiableCount = items.filter((i) => i.category === "unverifiable").length;
  const speculativeCount = items.filter((i) => i.category === "speculative").length;
  const tertiaryCount = items.filter((i) => i.category === "tertiary").length;
  const primaryCount = items.filter((i) => i.category === "primary").length;

  score -= anonymousCount * 14;
  score -= unverifiableCount * 18;
  score -= speculativeCount * 8;
  score -= tertiaryCount * 4;
  score += primaryCount * 5;

  const namedSources = items.filter((i) => i.sourceName && i.sourceName.length > 2).length;
  score += Math.min(15, (namedSources / items.length) * 20);

  return clampScore(Math.round(score));
}

export function buildCategoryDistribution(
  items: PrioritizedEvidenceItemJson[],
): Record<EvidencePriorityCategory, number> {
  const dist = emptyCategoryDistribution();
  for (const item of items) {
    dist[item.category] += 1;
  }
  return dist;
}

export function categoryTrustWeight(category: EvidencePriorityCategory): number {
  return CATEGORY_TRUST_WEIGHT[category];
}
