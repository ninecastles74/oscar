import type { ReliabilityCategoryId } from "@/types/news-platform";

export interface ScoringConfig {
  categoryWeights: Record<ReliabilityCategoryId, number>;
  rollingWindow: number;
  trendCompareWindow: number;
  /** Minimum score delta to classify trend as improving/declining. */
  trendDeltaThreshold: number;
  /** Points subtracted from contradiction_detection per incident. */
  contradictionPenaltyPerIncident: number;
  /** Max total contradiction penalty cap. */
  contradictionPenaltyCap: number;
  /** Weight applied to mean claim confidence in evidence_support (0–1). */
  confidenceInfluence: number;
  sensationalPenaltyPerHit: number;
  missingContextPenaltyPerFinding: number;
}

export const DEFAULT_CATEGORY_WEIGHTS: Record<ReliabilityCategoryId, number> = {
  evidence_support: 0.25,
  cross_source_corroboration: 0.2,
  context_completeness: 0.15,
  contradiction_detection: 0.15,
  sensationalism: 0.1,
  source_transparency: 0.15,
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
  rollingWindow: 20,
  trendCompareWindow: 5,
  trendDeltaThreshold: 4,
  contradictionPenaltyPerIncident: 18,
  contradictionPenaltyCap: 72,
  confidenceInfluence: 0.6,
  sensationalPenaltyPerHit: 8,
  missingContextPenaltyPerFinding: 12,
};

export function mergeScoringConfig(partial?: Partial<ScoringConfig>): ScoringConfig {
  return {
    ...DEFAULT_SCORING_CONFIG,
    ...partial,
    categoryWeights: {
      ...DEFAULT_SCORING_CONFIG.categoryWeights,
      ...partial?.categoryWeights,
    },
  };
}

export function validateScoringConfig(config: ScoringConfig): void {
  const sum = Object.values(config.categoryWeights).reduce((a, b) => a + b, 0);
  if (sum < 0.99 || sum > 1.01) {
    throw new Error(
      `Category weights must sum to 1.0 (got ${sum.toFixed(3)}). Adjust scoring config.`,
    );
  }
  for (const w of Object.values(config.categoryWeights)) {
    if (w < 0 || w > 1) throw new Error("Category weights must be between 0 and 1.");
  }
}
