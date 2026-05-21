import type { ScoringConfig } from "../config/scoring-config";
import type { ScoringSignals } from "../types/scoring.types";
import { clampScore } from "../utils/math";

export interface ContradictionMetrics {
  incidentCount: number;
  contradictionPenalty: number;
  contradictionDetectionScore: number;
}

export function computeContradictionMetrics(
  signals: ScoringSignals,
  config: ScoringConfig,
): ContradictionMetrics {
  const incidentCount =
    signals.contradictions.length + signals.issueSummary.contradictions;

  const rawPenalty = Math.min(
    config.contradictionPenaltyCap,
    incidentCount * config.contradictionPenaltyPerIncident,
  );

  return {
    incidentCount,
    contradictionPenalty: rawPenalty,
    contradictionDetectionScore: clampScore(100 - rawPenalty),
  };
}
