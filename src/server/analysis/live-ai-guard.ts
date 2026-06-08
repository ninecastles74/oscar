import type { AnalysisReport } from "@/types/news-platform";
import { hasHeuristicModelVerdicts } from "@/lib/live-analysis";
import { getLastGeminiAttemptLog, getLastGeminiError } from "../ai/gemini-client";
import {
  GEMINI_CAPACITY_USER_MESSAGE,
  hadGeminiCapacityFailure,
} from "../ai/gemini-resilience";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { AnalysisError } from "./errors";

export { hasHeuristicModelVerdicts, isLiveAnalysisReport } from "@/lib/live-analysis";

function hasSuccessfulLiveModelVerdicts(report: AnalysisReport): boolean {
  const claims = report.multiModelVerification?.claims ?? [];
  return claims.some((c) =>
    c.consensus.modelVerdicts.some(
      (m) => !m.skipped && m.model !== "unavailable" && !m.model?.includes("heuristic"),
    ),
  );
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

  const capacityDegraded =
    hadGeminiCapacityFailure() ||
    (report.pipelineWarnings?.some((w) => w.code === "GEMINI_CAPACITY_DEGRADED") ?? false);

  const gu = report.multiModelVerification.geminiUsage;
  const liveCalls = gu?.liveApiCalls ?? 0;
  const liveEvidence = gu?.liveEvidenceClaims ?? 0;
  const hasOtherLiveModels = hasSuccessfulLiveModelVerdicts(report);

  if (liveCalls === 0 && liveEvidence === 0 && !hasOtherLiveModels && !capacityDegraded) {
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

  if (capacityDegraded && liveCalls === 0 && liveEvidence === 0) {
    console.warn(
      "[live-ai-guard] continuing with degraded Gemini capacity — OpenAI/Claude path used",
    );
  }
}

/** User-safe warning text for UI (never raw HTTP errors). */
export function getAnalysisCapacityUserMessage(report: AnalysisReport): string | undefined {
  const fromReport = report.pipelineWarnings?.find((w) => w.code === "GEMINI_CAPACITY_DEGRADED")
    ?.message;
  if (fromReport) return fromReport;
  if (report.multiModelVerification?.geminiUsage?.userMessage) {
    return report.multiModelVerification.geminiUsage.userMessage;
  }
  if (hadGeminiCapacityFailure()) return GEMINI_CAPACITY_USER_MESSAGE;
  return undefined;
}
