import { computeDynamicWeight, classifyEvidenceType } from "@/server/evidence-weighting";
import { enrichAndPrioritizeEvidence } from "@/server/research/primary-evidence";
import type { EvidenceItem } from "@/types/news-platform";
import {
  classifyEvidencePriorityCategory,
  CATEGORY_TRUST_WEIGHT,
} from "./classify-category";
import {
  buildCategoryDistribution,
  computeEvidenceConfidenceScore,
  computeEvidenceQualityScore,
  computeSourceTransparencyScore,
} from "./scoring";
import type {
  PrimaryEvidencePrioritizationInput,
  PrimaryEvidencePrioritizationJson,
  PrioritizedEvidenceItemJson,
} from "./types";

/**
 * Primary Evidence Prioritization System
 *
 * Classifies evidence into trust tiers, applies weighted values, prioritizes
 * firsthand/official/direct sources, and down-weights summaries, unsourced,
 * anonymous, and speculative material. Returns structured JSON only.
 */
export function prioritizePrimaryEvidence(
  input: PrimaryEvidencePrioritizationInput,
): PrimaryEvidencePrioritizationJson {
  const enriched = enrichAndPrioritizeEvidence(input.evidence);

  const items: PrioritizedEvidenceItemJson[] = enriched.map((item) => {
    const category = classifyEvidencePriorityCategory(item, input.claimText);
    const weighted = computeDynamicWeight(item, {
      tier: item.tier,
      weakSourcing: item.weakSourcing,
      citesAnonymousSource: category === "anonymous",
      isCopiedReporting: item.isCopiedReporting,
    });

    return {
      id: item.id,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      category,
      trustWeight: CATEGORY_TRUST_WEIGHT[category],
      evidenceType: weighted.evidenceType ?? classifyEvidenceType(item),
      dynamicWeight: weighted.dynamicWeight,
      priorityRank: 0,
      supports: item.supports,
    };
  });

  items.sort((a, b) => {
    const catDiff = CATEGORY_TRUST_WEIGHT[b.category] - CATEGORY_TRUST_WEIGHT[a.category];
    if (catDiff !== 0) return catDiff;
    return b.dynamicWeight - a.dynamicWeight;
  });

  items.forEach((item, index) => {
    item.priorityRank = index + 1;
  });

  const supportingCount = items.filter((i) => i.supports).length;

  return {
    claimId: input.claimId,
    evidenceQualityScore: computeEvidenceQualityScore(items),
    evidenceConfidenceScore: computeEvidenceConfidenceScore(items, supportingCount),
    sourceTransparencyScore: computeSourceTransparencyScore(items),
    prioritizedEvidence: items,
    categoryDistribution: buildCategoryDistribution(items),
  };
}

/** Batch prioritize multiple claims. */
export function prioritizePrimaryEvidenceBatch(
  inputs: PrimaryEvidencePrioritizationInput[],
): PrimaryEvidencePrioritizationJson[] {
  return inputs.map(prioritizePrimaryEvidence);
}

/** Minimal evidence rows from coverage snippets. */
export function evidenceItemsFromCoverage(
  rows: {
    id: string;
    sourceId: string;
    sourceName: string;
    excerpt: string;
    url: string;
    publishedAt?: string;
    supports?: boolean;
  }[],
): EvidenceItem[] {
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    excerpt: row.excerpt,
    url: row.url,
    publishedAt: row.publishedAt ?? new Date().toISOString(),
    stance: row.supports === false ? "contradict" : "support",
    supports: row.supports !== false,
  }));
}
