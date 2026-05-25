import type {
  DynamicHistoricalReliabilityInput,
  DynamicHistoricalReliabilityReport,
} from "@/server/reliability/dynamic-historical";

/** Structured JSON from the Dynamic Historical Reliability Engine. */
export type DynamicHistoricalReliabilityJson = DynamicHistoricalReliabilityReport;

export type {
  DynamicHistoricalReliabilityInput,
  ReliabilityWindowTrend,
  ConfidenceTrend,
  TopicReliabilitySlice,
} from "@/server/reliability/dynamic-historical";
