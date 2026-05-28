import { auditSecretBindings, listDetectedAiEnvKeys, listMalformedEnvKeyAliases } from "../env/server-env";
import { getMultiModelProviderStatus } from "../multi-model/provider-status";
import { getGoogleAiApiKey, isGoogleAiConfigured } from "../ai/google-api-key";
import { geminiGenerateContent, getLastGeminiError } from "../ai/gemini-client";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { getServerEnv } from "../env/server-env";
import { getWorkerBindingsRecord, isFeedKvConfigured } from "../news/worker-env";
import { isMultiModelEnabled } from "../multi-model/config";

export async function getAiAnalysisDiagnostics() {
  ensureWorkerEnvFromPlatform();
  const user = getMultiModelProviderStatus("user");
  const scheduled = getMultiModelProviderStatus("scheduled");
  const secretAudit = auditSecretBindings();
  const configuredKeys = listDetectedAiEnvKeys();
  const malformedKeyAliases = listMalformedEnvKeyAliases();
  const bindings = getWorkerBindingsRecord();
  const bindingKeyNames = bindings ? Object.keys(bindings).filter((k) => !k.startsWith("__")).sort() : [];

  const emptyBindings = secretAudit.filter((a) => a.status === "empty");
  const geminiKey = getGoogleAiApiKey();
  let geminiSmokeTest: { ok: boolean; model?: string; error?: string } | undefined;
  if (geminiKey) {
    const ping = await geminiGenerateContent({
      user: 'Reply JSON only: {"ok":true}',
      jsonMode: true,
    });
    geminiSmokeTest = ping
      ? { ok: true, model: ping.model }
      : { ok: false, error: getLastGeminiError() ?? "Gemini ping failed" };
  }

  let likelyOfflineReason: string;
  if (geminiKey && geminiSmokeTest?.ok) {
    likelyOfflineReason =
      "Gemini key works (smoke test passed). If this report shows 0 live calls, it may be from an older run — run a new analysis.";
  } else if (geminiKey) {
    likelyOfflineReason =
      `Gemini key present but smoke test failed${geminiSmokeTest?.error ? `: ${geminiSmokeTest.error}` : ""}. Fix API key, model, or quota, then redeploy.`;
  } else if (emptyBindings.length > 0) {
    likelyOfflineReason =
      `Secret names exist but values are EMPTY (${emptyBindings.map((a) => a.key).join(", ")}). ` +
      "In Cloudflare → Workers → oscar → Settings → Secrets: delete and re-add each key with the real API value, then redeploy. " +
      "Use Secret (encrypted), not an empty Variable. For Gemini use GEMINI_API_KEY or GOOGLE_AI_API_KEY (not GOOGLE_API_KEY unless it is an AIza… key).";
  } else if (configuredKeys.length === 0) {
    likelyOfflineReason =
      "No API secrets on this Worker. Add GEMINI_API_KEY as a Secret on the oscar worker (Production), then redeploy.";
  } else if (malformedKeyAliases.length > 0) {
    likelyOfflineReason =
      `Bindings use malformed names (${malformedKeyAliases.join(", ")}). Values are read via normalized names; rename secrets in Cloudflare to GEMINI_API_KEY (no trailing "=").`;
  } else {
    likelyOfflineReason =
      "Some keys are set but not recognized for Gemini. Use GEMINI_API_KEY or GOOGLE_AI_API_KEY (Google AI Studio key, starts with AIza).";
  }

  return {
    user,
    scheduled,
    multiModelWouldRun: { user: isMultiModelEnabled("user"), scheduled: isMultiModelEnabled("scheduled") },
    googleConfigured: isGoogleAiConfigured(),
    googleKeyDetected: !!geminiKey,
    geminiKeyLength: geminiKey?.length,
    detectedAiEnvKeys: configuredKeys,
    malformedKeyAliases,
    secretBindings: secretAudit,
    openaiConfigured: !!(getServerEnv("OPENAI_API_KEY") || getServerEnv("OPENAI_KEYS")),
    anthropicConfigured: !!getServerEnv("ANTHROPIC_API_KEY"),
    workerBindingKeyNames: bindingKeyNames,
    feedKvConfigured: isFeedKvConfigured(),
    pipelineNotes: [
      "Live research uses GEMINI_API_KEY + Google Search when configured with a non-empty value.",
      "Empty secret names in the dashboard do not count as configured.",
    ],
    geminiSmokeTest,
    likelyOfflineReason,
  };
}
