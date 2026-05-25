import type {
  AnalysisExplainabilityBundle,
  AnalysisReport,
  ExplainableEntityType,
  ReliabilityScoreBundle,
  ScoreExplainability,
} from "@/types/news-platform";
import type { BuildExplainabilityInput } from "@/server/reliability/explainability/build-explainability";
import type { VerificationPipelineResults } from "@/server/analysis/verification/types";

export type ExplainabilityInput = BuildExplainabilityInput;

export interface ExplainabilityBundleInput {
  report: AnalysisReport;
  bundle: ReliabilityScoreBundle;
  results?: VerificationPipelineResults;
}

export interface ExplainabilityLookupInput {
  entityType: ExplainableEntityType;
  entityId: string;
  requestId?: string;
  articleId?: string;
}

/** Structured JSON for a single entity score explanation. */
export type ScoreExplainabilityJson = ScoreExplainability;

/** Structured JSON for article + source + author explanations. */
export type AnalysisExplainabilityBundleJson = AnalysisExplainabilityBundle;

/** Compact summary for panels and tooltips. */
export interface ExplainabilitySummaryJson {
  entityType: ExplainableEntityType;
  entityId: string;
  entityLabel: string;
  overallScore: number;
  supportingEvidenceCount: number;
  disputedEvidenceCount: number;
  corroboratingSourceCount: number;
  contradictionCount: number;
  omittedContextCount: number;
  calculationStepCount: number;
}

export type {
  ScoreExplainability,
  AnalysisExplainabilityBundle,
  ExplainableEntityType,
  ReliabilityScoreBundle,
  AnalysisReport,
};
