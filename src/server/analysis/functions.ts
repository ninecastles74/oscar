import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getManualAnalysisResult,
  getManualAnalysisStatus,
} from "./manual";
import { runGatedUserAnalysisSafe } from "./api-run";
import { getReliabilityBundleByArticleId } from "../reliability/engine";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "../reliability/snapshots";
import { getAiAnalysisDiagnostics } from "./ai-diagnostics";
import { testAiConnections } from "./test-ai-connections";
import { loadManualReliability } from "./manual-persist";

const idSchema = z.object({ requestId: z.string().min(1) });

export const submitManualAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const actorFields = {
      accessToken: z.string().optional(),
      anonymousId: z.string().max(128).optional(),
    };
    return z
      .object({
        url: z.string().url().optional(),
        text: z.string().min(80).max(100_000).optional(),
        title: z.string().max(300).optional(),
        userNotes: z.string().max(2000).optional(),
        language: z.string().min(2).max(5).optional(),
        ...actorFields,
      })
      .refine((d) => !!d.url?.trim() !== !!d.text?.trim(), {
        message: "Provide exactly one of url or text",
      })
      .parse(data);
  })
  .handler(async ({ data }) => runGatedUserAnalysisSafe(data));

export const getManualAnalysis = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const result = await getManualAnalysisResult(data.requestId);
    if (result) {
      let explainability;
      if (result.reliability) {
        try {
          explainability = buildFullExplainabilityBundle(
            result.report,
            result.reliability,
            getVerificationSnapshot(result.request.id)?.results,
          );
        } catch (err) {
          console.warn(
            "[getManualAnalysis] explainability skipped:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      return {
        requestId: result.request.id,
        status: result.request.status,
        report: result.report,
        submission: result.submission,
        request: result.request,
        reliability: result.reliability,
        explainability,
        finalIntelligence: result.finalIntelligence,
      };
    }

    const status = await getManualAnalysisStatus(data.requestId);
    if (!status) {
      return { error: { code: "NOT_FOUND", message: "Analysis request not found" } };
    }

    if (status.status === "failed") {
      return {
        requestId: status.id,
        status: "failed" as const,
        errorMessage: status.error ?? "Analysis failed",
        request: status,
      };
    }

    if (status.status === "completed") {
      const submission = status.submission;
      const reliability =
        (submission?.id ? getReliabilityBundleByArticleId(submission.id) : undefined) ??
        getReliabilityBundleByArticleId(status.id) ??
        status.reliability ??
        (await loadManualReliability(status.id));

      if (status.report) {
        let explainability;
        if (reliability) {
          try {
            explainability = buildFullExplainabilityBundle(
              status.report,
              reliability,
              getVerificationSnapshot(status.id)?.results,
            );
          } catch (err) {
            console.warn(
              "[getManualAnalysis] explainability skipped:",
              err instanceof Error ? err.message : err,
            );
          }
        }
        return {
          requestId: status.id,
          status: "completed" as const,
          report: status.report,
          submission,
          request: status,
          reliability,
          explainability,
          finalIntelligence: status.finalIntelligence,
        };
      }

      return {
        requestId: status.id,
        status: "failed" as const,
        errorMessage:
          status.error ??
          "Analysis finished but the report could not be loaded. Enable FEED_KV on the oscar Worker for reliable results, then retry.",
        request: status,
      };
    }

    return {
      requestId: status.id,
      status: status.status,
      progress: status.progress,
      error: status.error,
      request: status,
      startedAt: status.startedAt,
    };
  });

export const getAiDiagnostics = createServerFn({ method: "GET" }).handler(async () => {
  return getAiAnalysisDiagnostics();
});

export const testAiConnectionsFn = createServerFn({ method: "GET" }).handler(async () => testAiConnections());
