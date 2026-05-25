import {
  aggregateEvidenceQuality,
  classifyEvidenceType,
  computeDynamicWeight,
  weightEvidenceItems,
} from "@/server/evidence-weighting";
import type { EvidenceItem } from "@/types/news-platform";
import type {
  EvidenceWeightingAnalysisJson,
  EvidenceWeightingInput,
  WeightedEvidenceItemJson,
} from "./types";

function toWeightedJson(item: EvidenceItem): WeightedEvidenceItemJson {
  const weighted = computeDynamicWeight(item);
  return {
    id: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    evidenceType: weighted.evidenceType,
    dynamicWeight: weighted.dynamicWeight,
    weightBreakdown: weighted.weightBreakdown,
    stance: item.stance,
    supports: item.supports,
  };
}

/**
 * Evidence Weighting Engine — classifies evidence types, applies dynamic weights
 * from source reliability and document type, and returns structured JSON only.
 */
export function analyzeEvidenceWeighting(
  input: EvidenceWeightingInput,
): EvidenceWeightingAnalysisJson {
  const weighted = weightEvidenceItems(input.evidence);
  const quality = aggregateEvidenceQuality(weighted);

  const weightedEvidence: WeightedEvidenceItemJson[] = weighted.map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    evidenceType: item.evidenceType ?? classifyEvidenceType(item),
    dynamicWeight: item.dynamicWeight ?? 0,
    weightBreakdown: item.weightBreakdown!,
    stance: item.stance,
    supports: item.supports,
  }));

  const supportingCount = weighted.filter((e) => e.stance === "support" || e.supports).length;

  return {
    claimId: input.claimId,
    aggregateScore: quality.aggregateScore,
    supportingWeightTotal: quality.supportingWeightTotal,
    evidenceCount: input.evidence.length,
    supportingCount,
    weightedEvidence,
    typeDistribution: quality.typeDistribution,
    highestWeightEvidenceId: quality.highestWeightEvidenceId,
    lowestWeightEvidenceId: quality.lowestWeightEvidenceId,
  };
}

/** Weight a single evidence item (structured JSON). */
export function weightSingleEvidence(item: EvidenceItem): WeightedEvidenceItemJson {
  return toWeightedJson(item);
}

/** Batch analyze multiple claims. */
export function analyzeEvidenceWeightingBatch(
  inputs: EvidenceWeightingInput[],
): EvidenceWeightingAnalysisJson[] {
  return inputs.map(analyzeEvidenceWeighting);
}
