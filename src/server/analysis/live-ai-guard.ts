import type { AnalysisReport } from "@/types/news-platform";
import { getLastGeminiError } from "../ai/gemini-client";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { AnalysisError } from "./errors";

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

/** Fail if the report used mock/heuristic pipeline or has no successful live AI calls. */
export function assertLiveAnalysisReport(
  report: AnalysisReport,
  stages: string[] = [],
): void {
  if (!isGoogleAiConfigured()) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Live analysis requires GEMINI_API_KEY (or GOOGLE_AI_API_KEY) on the oscar Worker.",
      503,
    );
  }

  if (stages.includes("extractClaimsHeuristic") || stages.includes("retrieveEvidenceMock")) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Analysis used offline mock/heuristic data. Live AI claim extraction and web evidence are required.",
      503,
    );
  }

  if (!report.multiModelVerification) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Multi-model verification did not complete.",
      503,
    );
  }

  if (hasHeuristicModelVerdicts(report)) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Report contains simulated model verdicts. Only live API responses are allowed.",
      503,
    );
  }

  const gu = report.multiModelVerification.geminiUsage;
  const liveCalls = gu?.liveApiCalls ?? 0;
  const liveEvidence = gu?.liveEvidenceClaims ?? 0;
  if (liveCalls === 0 && liveEvidence === 0) {
    const err = gu?.lastApiError ?? getLastGeminiError();
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      err
        ? `No successful live Gemini calls. ${err}`
        : "No successful live Gemini calls. Check Worker logs, model name, and API quota.",
      503,
    );
  }
}
