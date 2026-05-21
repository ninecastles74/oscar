import type {
  EvidenceDocumentType,
  EvidenceItem,
  EvidenceWeightBreakdown,
  ResearchEvidence,
} from "@/types/news-platform";
import { approvedSourceById } from "../analysis/sources";
import { BASE_TYPE_WEIGHTS, LOW_TRUST_TYPES } from "./config";
import { classifyEvidenceType } from "./classify-evidence";
import { clampScore } from "../reliability/utils/math";

export interface WeightingContext {
  isCopiedReporting?: boolean;
  weakSourcing?: boolean;
  citesAnonymousSource?: boolean;
  tier?: ResearchEvidence["tier"];
}

/**
 * Compute dynamic evidence weight from type, source reliability, and context penalties.
 */
export function computeDynamicWeight(
  item: EvidenceItem,
  context: WeightingContext = {},
): {
  evidenceType: EvidenceDocumentType;
  dynamicWeight: number;
  weightBreakdown: EvidenceWeightBreakdown;
} {
  let evidenceType = item.evidenceType ?? classifyEvidenceType(item);
  const adjustments: EvidenceWeightBreakdown["adjustments"] = [];

  if (context.citesAnonymousSource || evidenceType === "anonymous_sourcing") {
    evidenceType = "anonymous_sourcing";
  }
  if (context.isCopiedReporting) {
    evidenceType = "syndicated_rewrite";
  } else if (context.tier === "derivative" && !LOW_TRUST_TYPES.includes(evidenceType)) {
    evidenceType = "secondary_summary";
  }

  const baseTypeWeight = BASE_TYPE_WEIGHTS[evidenceType];
  const srcReliability = approvedSourceById(item.sourceId)?.reliability ?? 50;
  const sourceReliabilityFactor = 0.72 + (srcReliability / 100) * 0.28;

  let weight = baseTypeWeight * sourceReliabilityFactor;
  adjustments.push({
    label: `Source reliability (${srcReliability}%)`,
    delta: Math.round((sourceReliabilityFactor - 1) * baseTypeWeight),
  });

  if (item.isDirectQuote && evidenceType === "firsthand_reporting") {
    adjustments.push({ label: "Direct quote", delta: 5 });
    weight += 5;
  }

  if (context.weakSourcing) {
    adjustments.push({ label: "Weak sourcing", delta: -18 });
    weight -= 18;
  }

  if (context.tier === "primary" && !LOW_TRUST_TYPES.includes(evidenceType)) {
    adjustments.push({ label: "Primary tier", delta: 6 });
    weight += 6;
  }

  if (item.stance === "contradict") {
    adjustments.push({ label: "Contradicting stance (weight retained for scoring)", delta: 0 });
  }

  const capForLowTrust = LOW_TRUST_TYPES.includes(evidenceType)
    ? BASE_TYPE_WEIGHTS[evidenceType]
    : 100;
  const finalWeight = clampScore(Math.min(capForLowTrust + 15, weight));

  return {
    evidenceType,
    dynamicWeight: finalWeight,
    weightBreakdown: {
      baseTypeWeight,
      sourceReliabilityFactor: Math.round(sourceReliabilityFactor * 100) / 100,
      adjustments,
      finalWeight,
    },
  };
}

export function applyWeightsToResearchEvidence(
  items: ResearchEvidence[],
): ResearchEvidence[] {
  return items.map((item) => {
    const weighted = computeDynamicWeight(item, {
      isCopiedReporting: item.isCopiedReporting,
      weakSourcing: item.weakSourcing,
      citesAnonymousSource: item.citesAnonymousSource,
      tier: item.tier,
    });
    return {
      ...item,
      ...weighted,
      reliabilityWeight: weighted.dynamicWeight,
    };
  });
}
