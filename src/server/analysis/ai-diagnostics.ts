import { listDetectedAiEnvKeys } from "../env/server-env";
import { getMultiModelProviderStatus } from "../multi-model/provider-status";
import { getGoogleAiApiKey, isGoogleAiConfigured } from "../ai/google-api-key";
import { getWorkerBindingsRecord, isFeedKvConfigured } from "../news/worker-env";
import { isMultiModelEnabled } from "../multi-model/config";

export function getAiAnalysisDiagnostics() {
  const user = getMultiModelProviderStatus("user");
  const scheduled = getMultiModelProviderStatus("scheduled");
  const detectedKeys = listDetectedAiEnvKeys();
  const bindings = getWorkerBindingsRecord();
  const bindingKeyNames = bindings ? Object.keys(bindings).filter((k) => !k.startsWith("__")).sort() : [];

  return {
    user,
    scheduled,
    multiModelWouldRun: { user: isMultiModelEnabled("user"), scheduled: isMultiModelEnabled("scheduled") },
    googleConfigured: isGoogleAiConfigured(),
    googleKeyDetected: !!getGoogleAiApiKey(),
    detectedAiEnvKeys: detectedKeys,
    workerBindingKeyNames: bindingKeyNames,
    feedKvConfigured: isFeedKvConfigured(),
    pipelineNotes: [
      "Claim extraction and story consensus never call paid LLM APIs.",
      "Ask Oscar always runs multi-model verification; live calls require keys on the Worker.",
    ],
    likelyOfflineReason:
      detectedKeys.length === 0
        ? "Worker runtime sees no API keys — add GEMINI_API_KEY as Secret on the oscar Worker and redeploy."
        : !user.googleConfigured
          ? "Keys not mapped to GOOGLE_AI_API_KEY / GEMINI_API_KEY names."
          : "Keys visible; if Live Gemini calls = 0, check Worker logs for [gemini] API errors.",
  };
}
