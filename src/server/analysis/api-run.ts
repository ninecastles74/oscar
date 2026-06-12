import { z } from "zod";
import { AnalysisError } from "./errors";
import {
  beginManualAnalysis,
  executeManualAnalysis,
  getManualAnalysisResult,
  getManualAnalysisStatus,
} from "./manual";
import {
  captureWorkerEnvSnapshot,
  hasAnyAiApiKey,
  listApiKeyEnvNames,
} from "../env/server-env";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { isManualAnalysisKvConfigured } from "./manual-persist";
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

function mapAnalysisStatus(status: string | undefined): "completed" | "failed" | "processing" {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

export type GatedAnalysisResult =
  | {
      error: {
        code: string;
        message: string;
        statusCode: number;
        quota?: Awaited<ReturnType<typeof getQuotaStatus>>;
      };
    }
  | {
      requestId: string;
      submissionId: string;
      status: "completed" | "failed" | "processing";
      quota: Awaited<ReturnType<typeof getQuotaStatus>>;
      envKeysDetected: string[];
      kvConfigured: boolean;
      failedMessage?: string;
      analysisSnapshot?: {
        report: NonNullable<Awaited<ReturnType<typeof getManualAnalysisResult>>>["report"];
        reliability: NonNullable<Awaited<ReturnType<typeof getManualAnalysisResult>>>["reliability"];
        finalIntelligence: NonNullable<
          Awaited<ReturnType<typeof getManualAnalysisResult>>
        >["finalIntelligence"];
        submission: NonNullable<Awaited<ReturnType<typeof getManualAnalysisResult>>>["submission"];
      };
      envWarning?: string;
    };

/** Shared Ask Oscar gate + kickoff used by server fn and REST API. */
export async function runGatedUserAnalysis(
  data: z.infer<typeof submitSchema>,
): Promise<GatedAnalysisResult> {
  const actor = await resolveActor({
    accessToken: data.accessToken,
    anonymousId: data.anonymousId,
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
    url: data.url,
    text: data.text,
    title: data.title,
    userNotes: data.userNotes,
    language: data.language,
    userId: actor.userId,
    analysisTrigger: "user",
  });

  await recordAiAnalysisUsage({
    actor,
    kind: "manual_article",
    requestId,
  });

  const envSnapshot = captureWorkerEnvSnapshot();
  const apiKeys = listApiKeyEnvNames(envSnapshot);
  const quota = await getQuotaStatus(actor);
  const kvConfigured = isManualAnalysisKvConfigured();

  console.log("[runGatedUserAnalysis] pipeline started", { requestId, kvConfigured });

  // Always await user Ask Oscar analysis in this request so the client receives
  // completed/failed status + snapshot (background jobs were losing state across isolates).
  try {
    await executeManualAnalysis(requestId, envSnapshot);
    console.log("[runGatedUserAnalysis] pipeline completed", requestId);
  } catch (err) {
    console.error(
      "[runGatedUserAnalysis] analysis failed:",
      err instanceof Error ? err.message : err,
    );
  }
  const done = await getManualAnalysisStatus(requestId);
  const status = mapAnalysisStatus(done?.status);
  let full = status === "completed" ? await getManualAnalysisResult(requestId) : null;

  if (status === "completed" && !full && done?.report && done.submission) {
    full = {
      request: done,
      submission: done.submission,
      report: done.report,
      reliability: done.reliability,
      finalIntelligence: done.finalIntelligence,
    };
  }

  if (status === "completed" && !full) {
    return {
      requestId,
      submissionId,
      status: "failed",
      failedMessage:
        done?.error ??
        "Analysis finished but results could not be loaded. Enable FEED_KV on the oscar Worker for reliable Ask Oscar.",
      quota,
      envKeysDetected: apiKeys,
      kvConfigured,
    };
  }

  if (status === "failed") {
    return {
      requestId,
      submissionId,
      status: "failed",
      failedMessage: done?.error ?? "Analysis failed",
      quota,
      envKeysDetected: apiKeys,
      kvConfigured,
    };
  }

  return {
    requestId,
    submissionId,
    status,
    failedMessage: done?.error,
    quota,
    envKeysDetected: apiKeys,
    kvConfigured,
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

export function parseManualSubmitBody(data: unknown) {
  return submitSchema.parse(data);
}

export async function runGatedUserAnalysisSafe(data: unknown): Promise<GatedAnalysisResult> {
  try {
    return await runGatedUserAnalysis(parseManualSubmitBody(data));
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
}
