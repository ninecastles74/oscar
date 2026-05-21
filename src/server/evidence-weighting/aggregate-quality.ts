import type {
  EvidenceDocumentType,
  EvidenceQualityAssessment,
  EvidenceItem,
  ResearchEvidence,
} from "@/types/news-platform";
import { HIGH_TRUST_TYPES, LOW_TRUST_TYPES, TYPE_LABELS } from "./config";
import { applyWeightsToResearchEvidence, computeDynamicWeight } from "./compute-weight";
import { clampScore } from "../reliability/utils/math";

/**
 * Weight a list of evidence items (pre-research shape).
 */
export function weightEvidenceItems(items: EvidenceItem[]): EvidenceItem[] {
  return items.map((item) => {
    const weighted = computeDynamicWeight(item);
    return { ...item, ...weighted };
  });
}

/**
 * Aggregate dynamic evidence quality for a claim's evidence set.
 */
export function aggregateEvidenceQuality(
  items: Array<EvidenceItem | ResearchEvidence>,
): EvidenceQualityAssessment {
  const enriched: ResearchEvidence[] =
    items.length > 0 && "tier" in items[0]
      ? applyWeightsToResearchEvidence(items as ResearchEvidence[])
      : weightEvidenceItems(items).map((e) => ({
          ...e,
          tier: "secondary" as const,
          reliabilityWeight: e.dynamicWeight ?? 50,
          evidenceType: e.evidenceType ?? "standard_reporting",
          dynamicWeight: e.dynamicWeight ?? 50,
          weightBreakdown: e.weightBreakdown!,
          isCopiedReporting: false,
          isIndependentConfirmation: false,
          weakSourcing: false,
          citesAnonymousSource: false,
        }));

  const supporting = enriched.filter((e) => e.stance === "support" || e.supports);
  const weights = supporting.map((e) => e.dynamicWeight);

  const typeDistribution: Partial<Record<EvidenceDocumentType, number>> = {};
  for (const e of enriched) {
    typeDistribution[e.evidenceType] = (typeDistribution[e.evidenceType] ?? 0) + 1;
  }

  if (weights.length === 0) {
    return {
      aggregateScore: 0,
      supportingWeightTotal: 0,
      typeDistribution,
      summary: "No supporting evidence to weight.",
    };
  }

  const sorted = [...supporting].sort((a, b) => b.dynamicWeight - a.dynamicWeight);
  const topCount = Math.max(1, Math.ceil(weights.length * 0.4));
  const topWeights = sorted.slice(0, topCount).map((e) => e.dynamicWeight);
  const aggregateScore = clampScore(
    topWeights.reduce((s, w) => s + w, 0) / topWeights.length,
  );
  const supportingWeightTotal = weights.reduce((s, w) => s + w, 0);

  const highTrust = supporting.filter((e) => HIGH_TRUST_TYPES.includes(e.evidenceType)).length;
  const lowTrust = supporting.filter((e) => LOW_TRUST_TYPES.includes(e.evidenceType)).length;

  const summaryParts = [
    `Evidence quality ${aggregateScore}/100 from ${supporting.length} supporting item(s).`,
    `Weighted total ${supportingWeightTotal}; top type: ${TYPE_LABELS[sorted[0].evidenceType]}.`,
  ];
  if (highTrust > 0) summaryParts.push(`${highTrust} high-trust source type(s).`);
  if (lowTrust > 0) summaryParts.push(`${lowTrust} lower-trust source type(s) reduce composite.`);

  return {
    aggregateScore,
    supportingWeightTotal,
    highestWeightEvidenceId: sorted[0]?.id,
    lowestWeightEvidenceId: sorted[sorted.length - 1]?.id,
    typeDistribution,
    summary: summaryParts.join(" "),
  };
}

/**
 * Sum of dynamic weights for supporting evidence (used in verification confidence).
 */
export function supportingWeightSum(items: EvidenceItem[]): number {
  return weightEvidenceItems(items)
    .filter((e) => e.stance === "support" || e.supports)
    .reduce((sum, e) => sum + (e.dynamicWeight ?? 0), 0);
}
