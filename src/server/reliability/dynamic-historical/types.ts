import type {
  Category,
  HistoricalEntityType,
  ReliabilityTrendDirection,
  TrendGraphPoint,
} from "@/types/news-platform";
import type { ComputeReliabilityInput } from "../engine";

export interface DynamicHistoricalReliabilityInput {
  entityType: HistoricalEntityType;
  entityId: string;
  topic?: Category;
  asOf?: Date;
  /** Recalculate rolling scores when new evidence or verification updates arrive. */
  recalculate?: {
    reportId: string;
    compute?: ComputeReliabilityInput;
  };
}

export interface ReliabilityWindowTrend {
  windowDays: 7 | 30 | 90 | 365;
  rollingAverage: number | null;
  direction: ReliabilityTrendDirection;
  delta: number | null;
  sampleSize: number;
  overallScore: number | null;
  contradictionFrequency: number | null;
  evidenceQualityAverage: number | null;
  correctionCount: number;
  points: TrendGraphPoint[];
}

export interface ConfidenceTrend {
  direction: ReliabilityTrendDirection;
  currentValue: number | null;
  rollingAverage: number | null;
  sevenDayAverage: number | null;
  thirtyDayAverage: number | null;
  delta30d: number | null;
  sampleSize: number;
  points: TrendGraphPoint[];
}

export interface TopicReliabilitySlice {
  topic: string;
  overallScore: number;
  rollingAverage: number;
  trendDirection: ReliabilityTrendDirection;
  articlesScored: number;
}

/** Structured output from the Dynamic Historical Reliability Engine. */
export interface DynamicHistoricalReliabilityReport {
  entityType: HistoricalEntityType;
  entityId: string;
  topic?: Category;
  sevenDayTrend: ReliabilityWindowTrend;
  thirtyDayTrend: ReliabilityWindowTrend;
  ninetyDayTrend: ReliabilityWindowTrend;
  yearlyTrend: ReliabilityWindowTrend;
  confidenceTrend: ConfidenceTrend;
  topicReliability: TopicReliabilitySlice[];
  historicalReliabilityScore: number;
  recalculated: boolean;
  computedAt: string;
}
