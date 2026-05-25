import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalysisError } from "./errors";
import { getManualAnalysisResult, getManualAnalysisStatus, runManualAnalysis } from "./manual";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "../reliability/snapshots";
import {
  assertAiAnalysisQuota,
  getQuotaStatus,
  recordAiAnalysisUsage,
  resolveActor,
} from "../usage/quota";

const actorFields = {
  accessToken: z.string().optional(),
  anonymousId: z.string().max(128).optional(),
};

const submitSchema = z
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
  });

const idSchema = z.object({ requestId: z.string().min(1) });

async function runGatedUserAnalysis(data: z.infer<typeof submitSchema>) {
  const kind = "manual_article" as const;
  const actor = await resolveActor({
    accessToken: "accessToken" in data ? data.accessToken : undefined,
    anonymousId: data.anonymousId,
  });

  const gate = await assertAiAnalysisQuota(actor);
  if (!gate.allowed) {
    return {
      error: {
        code: "QUOTA_EXCEEDED",
        message: gate.message ?? "Daily analysis limit reached.",
        statusCode: 429,
        quota: gate.status,
      },
    };
  }

  const result = await runManualAnalysis({
    url: "url" in data ? data.url : undefined,
    text: data.text,
    title: data.title,
    userNotes: data.userNotes,
    language: data.language,
    userId: actor.userId,
    analysisTrigger: "user",
  });

  await recordAiAnalysisUsage({
    actor,
    kind,
    requestId: result.request.id,
  });

  const quota = await getQuotaStatus(actor);

  return {
    requestId: result.request.id,
    submissionId: result.submission.id,
    status: result.request.status,
    report: result.report,
    submission: result.submission,
    reliability: result.reliability,
    finalIntelligence: result.finalIntelligence,
    quota,
  };
}

/** Submit URL or pasted text for manual claim verification (counts toward daily AI quota). */
export const submitManualAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      return runGatedUserAnalysis(data);
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
        finalIntelligence: result.finalIntelligence,
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
