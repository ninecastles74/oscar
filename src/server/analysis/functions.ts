import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AnalysisError } from "./errors";
import {
  beginManualAnalysis,
  executeManualAnalysis,
  getManualAnalysisResult,
  getManualAnalysisStatus,
} from "./manual";
import { runInWorkerBackground } from "../news/worker-env";
import {
  captureWorkerEnvSnapshot,
  hasAnyAiApiKey,
  listApiKeyEnvNames,
} from "../env/server-env";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { isManualAnalysisKvConfigured } from "./manual-persist";
import { buildFullExplainabilityBundle } from "../reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "../reliability/snapshots";
import { getAiAnalysisDiagnostics } from "./ai-diagnostics";
import { testAiConnections } from "./test-ai-connections";
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

function mapAnalysisStatus(status: string | undefined): "completed" | "failed" | "processing" {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

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

  const { requestId, submissionId } = await beginManualAnalysis({
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
    requestId,
  });

  ensureWorkerEnvFromPlatform();

  if (!isGoogleAiConfigured()) {
    return {
      error: {
        code: "LIVE_AI_REQUIRED",
        message:
          "Live analysis requires GEMINI_API_KEY on the oscar Worker. Mock and offline reports are disabled.",
        statusCode: 503,
      },
    };
  }

  const envSnapshot = captureWorkerEnvSnapshot();
  const apiKeys = listApiKeyEnvNames(envSnapshot);
  const quota = await getQuotaStatus(actor);
  const kvConfigured = isManualAnalysisKvConfigured();

  const runAnalysis = () =>
    executeManualAnalysis(requestId, envSnapshot).catch((err) => {
      console.error(
        "[submitManualAnalysis] analysis failed:",
        err instanceof Error ? err.message : err,
      );
    });

  if (kvConfigured) {
    runInWorkerBackground(runAnalysis());
    return {
      requestId,
      submissionId,
      status: "processing" as const,
      quota,
      envKeysDetected: apiKeys,
      kvConfigured: true,
    };
  }

  await runAnalysis();
  const done = await getManualAnalysisStatus(requestId);
  const status = mapAnalysisStatus(done?.status);
  const full = status === "completed" ? await getManualAnalysisResult(requestId) : null;

  return {
    requestId,
    submissionId,
    status,
    failedMessage: done?.error,
    quota,
    envKeysDetected: apiKeys,
    kvConfigured: false,
    analysisSnapshot: full
      ? {
          report: full.report,
          reliability: full.reliability,
          finalIntelligence: full.finalIntelligence,
          submission: full.submission,
        }
      : undefined,
    envWarning: hasAnyAiApiKey(envSnapshot)
      ? undefined
      : "No API keys visible to this Worker. Add GEMINI_API_KEY as a Secret on the oscar worker, redeploy, then retry.",
  };
}

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

export const getManualAnalysis = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const result = await getManualAnalysisResult(data.requestId);
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
