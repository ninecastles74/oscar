import type { AnalysisReport } from "@/types/news-platform";
import { hasHeuristicModelVerdicts } from "@/lib/live-analysis";
import { getLastGeminiAttemptLog, getLastGeminiError } from "../ai/gemini-client";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { AnalysisError } from "./errors";

export { hasHeuristicModelVerdicts, isLiveAnalysisReport } from "@/lib/live-analysis";

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
  const hasPartialEvidenceWarning = report.pipelineWarnings?.some(
    (w) => w.code === "PARTIAL_LIVE_EVIDENCE",
  );
  const hasAnyScoredClaims = (report.claims?.length ?? 0) > 0;

  if (liveCalls === 0 && liveEvidence === 0 && !hasPartialEvidenceWarning && !hasAnyScoredClaims) {
    console.error(
      "[live-ai-guard] no live AI signals",
      getLastGeminiAttemptLog().join("; ") || getLastGeminiError(),
    );
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Analysis could not complete with live AI. Check API keys and quota, then retry in a few minutes.",
      503,
    );
  }
}
