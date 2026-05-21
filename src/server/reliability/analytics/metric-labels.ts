import type { HistoricalMetricType } from "@/types/news-platform";

export const METRIC_LABELS: Record<HistoricalMetricType, string> = {
  overall_score: "Overall Reliability",
  rolling_average: "Rolling Average",
  confidence: "Claim Confidence",
  contradiction_count: "Contradiction Count",
  contradiction_detection: "Contradiction Detection",
  sensationalism: "Sensationalism (inverse)",
  evidence_support: "Evidence Support",
  corroboration_rate: "Corroboration Rate",
  reporting_consistency: "Reporting Consistency",
  source_transparency: "Source Transparency",
};
