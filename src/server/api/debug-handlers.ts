import { z } from "zod";
import { classifyClaims } from "../analysis/verification/classifyClaims";
import { extractClaimsWithLlm } from "../analysis/verification/extractClaimsLlm";
import { retrieveEvidenceLive } from "../analysis/verification/retrieveEvidenceLive";
import { scoreConfidence } from "../analysis/verification/scoreConfidence";
import { isGoogleAiConfigured } from "../ai/google-api-key";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { jsonError, jsonOk } from "./response";

const DEFAULT_DEBUG_TEXT =
  "According to public health officials, seasonal flu vaccination rates among adults over 65 increased in several U.S. states during the most recent reporting period, based on state health department data released this week.";

const bodySchema = z.object({
  text: z.string().min(80).max(2000).optional(),
});

/** Quick single-claim pipeline check — real AI, no mock verdicts. */
export async function handleDebugAnalyzeMinimal(request: Request): Promise<Response> {
  console.log("[api/debug/analyze-minimal] route hit");
  ensureWorkerEnvFromPlatform();

  if (!isGoogleAiConfigured()) {
    return jsonError("GEMINI_API_KEY is required for minimal analysis check", {
      status: 503,
      code: "LIVE_AI_REQUIRED",
    });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid request body", {
      status: 400,
      details: parsed.error.message,
      code: "VALIDATION_ERROR",
    });
  }

  const analysisText = parsed.data.text ?? DEFAULT_DEBUG_TEXT;
  const startedAt = Date.now();
  console.log("[api/debug/analyze-minimal] pipeline started");

  try {
    const rawClaims = await extractClaimsWithLlm(analysisText, "debug-minimal");
    if (!rawClaims?.length) {
      return jsonError("Claim extraction returned no results", {
        status: 503,
        code: "ANALYSIS_FAILED",
      });
    }

    const classified = classifyClaims(rawClaims).slice(0, 1);
    const evidenceResult = await retrieveEvidenceLive(classified);
    const claim = classified[0]!;
    const evidence = evidenceResult.evidenceByClaimId[claim.id] ?? [];
    const scored = scoreConfidence(
      classified,
      evidenceResult.evidenceByClaimId,
      [],
      [],
      { liveEvidenceFailedClaimIds: new Set(evidenceResult.failedClaimIds) },
    )[0];

    const runtimeMs = Date.now() - startedAt;
    console.log("[api/debug/analyze-minimal] pipeline completed in", runtimeMs, "ms");

    return jsonOk({
      success: true,
      runtimeMs,
      stagesCompleted: ["extractClaims", "retrieveEvidence", "scoreConfidence"],
      claim: {
        claimText: claim.text,
        claimType: claim.kind,
        status: scored?.verdict ?? "insufficient_evidence",
        confidenceScore: scored?.confidence ?? 20,
        evidenceCount: evidence.length,
        evidenceRetrievalFailed: evidenceResult.failedClaimIds.includes(claim.id),
      },
      geminiConfigured: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/debug/analyze-minimal] failed:", message);
    return jsonError("Minimal analysis check failed", {
      status: 500,
      code: "ANALYSIS_FAILED",
      details: message,
    });
  }
}
