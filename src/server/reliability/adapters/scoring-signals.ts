import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../../analysis/types";
import type { VerificationPipelineResults } from "../../analysis/verification/types";
import type { ScoringSignals } from "../types/scoring.types";

/** Build scoring signals from verification output (supports evidence updates / recalc). */
export function toScoringSignals(
  report: AnalysisReport,
  results: VerificationPipelineResults,
  article: PipelineArticleContext,
): ScoringSignals {
  return {
    claims: report.claims,
    comparisons: report.sourceComparisons ?? [],
    contradictions: results.contradictions,
    missingContext: results.missingContext,
    issueSummary: report.issueSummary,
    article,
  };
}
