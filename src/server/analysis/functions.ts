import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalysisError } from "./errors";
import { getManualAnalysisResult, getManualAnalysisStatus, runManualAnalysis } from "./manual";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "../reliability/snapshots";

const submitSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().min(80).max(100_000).optional(),
    title: z.string().max(300).optional(),
    userNotes: z.string().max(2000).optional(),
    language: z.string().min(2).max(5).optional(),
  })
  .refine((d) => !!d.url?.trim() !== !!d.text?.trim(), {
    message: "Provide exactly one of url or text",
  });

const idSchema = z.object({ requestId: z.string().min(1) });

/** Submit URL or pasted text for manual claim verification. */
export const submitManualAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const result = await runManualAnalysis(data);
      return {
        requestId: result.request.id,
        submissionId: result.submission.id,
        status: result.request.status,
        report: result.report,
        submission: result.submission,
        reliability: result.reliability,
      };
    } catch (err) {
      if (err instanceof AnalysisError) {
        return {
          error: {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
          },
        };
      }
      throw err;
    }
  });

/** Fetch a completed manual analysis by request id. */
export const getManualAnalysis = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const result = getManualAnalysisResult(data.requestId);
    if (result) {
      const explainability = buildFullExplainabilityBundle(
        result.report,
        result.reliability,
        getVerificationSnapshot(result.request.id)?.results,
      );
      return {
        requestId: result.request.id,
        status: result.request.status,
        report: result.report,
        submission: result.submission,
        request: result.request,
        reliability: result.reliability,
        explainability,
      };
    }

    const status = getManualAnalysisStatus(data.requestId);
    if (!status) {
      return { error: { code: "NOT_FOUND", message: "Analysis request not found" } };
    }

    return {
      requestId: status.id,
      status: status.status,
      progress: status.progress,
      error: status.error,
      request: status,
    };
  });
