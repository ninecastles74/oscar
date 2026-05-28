import type { AnalysisReport } from "@/types/news-platform";

export function hasHeuristicModelVerdicts(report: AnalysisReport): boolean {
  const claims = report.multiModelVerification?.claims ?? [];
  return claims.some((c) =>
    c.consensus.modelVerdicts.some(
      (m) =>
        m.model?.includes("heuristic") ||
        m.skipReason?.includes("heuristic") ||
        m.skipReason?.includes("not configured"),
    ),
  );
}

export function isLiveAnalysisReport(report: AnalysisReport | undefined): boolean {
  if (!report?.multiModelVerification) return false;
  if (hasHeuristicModelVerdicts(report)) return false;
  const gu = report.multiModelVerification.geminiUsage;
  const liveCalls = gu?.liveApiCalls ?? 0;
  const liveEvidence = gu?.liveEvidenceClaims ?? 0;
  return liveCalls > 0 || liveEvidence > 0;
}
