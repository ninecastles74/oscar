import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import type { VerificationPipelineResults } from "../analysis/verification/types";

const byReportId = new Map<
  string,
  {
    report: AnalysisReport;
    results: VerificationPipelineResults;
    article: PipelineArticleContext;
  }
>();

export function saveVerificationSnapshot(
  reportId: string,
  report: AnalysisReport,
  results: VerificationPipelineResults,
  article: PipelineArticleContext,
): void {
  byReportId.set(reportId, { report, results, article });
}

export function getVerificationSnapshot(reportId: string) {
  return byReportId.get(reportId);
}

export function listVerificationSnapshotReportIds(): string[] {
  return [...byReportId.keys()];
}
