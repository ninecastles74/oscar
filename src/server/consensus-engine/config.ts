import type { ConsensusSignalDimension } from "@/types/news-platform";

/** Dimension weights (sum = 1.0). */
export const SIGNAL_WEIGHTS: Record<ConsensusSignalDimension, number> = {
  evidence_quality: 0.2,
  ai_reasoning: 0.22,
  source_independence: 0.15,
  contradiction_analysis: 0.18,
  corroboration: 0.15,
  historical_reliability: 0.1,
};

export const SIGNAL_LABELS: Record<ConsensusSignalDimension, string> = {
  evidence_quality: "Evidence quality",
  ai_reasoning: "AI reasoning",
  source_independence: "Source independence",
  contradiction_analysis: "Contradiction analysis",
  corroboration: "Corroboration",
  historical_reliability: "Historical reliability",
};

/** Composite score thresholds (epistemic, not truth). */
export const VERDICT_THRESHOLDS = {
  supportedMinComposite: 62,
  supportedMinCorroboration: 38,
  supportedMinContradictionSignal: 48,
  unclearMinComposite: 38,
  insufficientMaxEvidence: 22,
  disputedMaxContradictionSignal: 38,
} as const;
