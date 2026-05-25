import { getMultiModelProviderStatus } from "../multi-model/provider-status";
import { getGoogleAiApiKey } from "../ai/google-api-key";

export function getAiAnalysisDiagnostics() {
  const user = getMultiModelProviderStatus("user");
  const scheduled = getMultiModelProviderStatus("scheduled");

  const googleKeyPresent = !!getGoogleAiApiKey();

  return {
    user,
    scheduled,
    pipelineNotes: [
      "Claim extraction, evidence, and story consensus are rule-based — they never call OpenAI/Claude/Gemini.",
      "Live LLM calls happen only in multi-model verification (OpenAI primary, Claude review, Gemini corroboration).",
      "Story Consensus on /stories is cross-article alignment only — no external AI APIs.",
    ],
    productionChecklist: [
      "Add GEMINI_API_KEY or GOOGLE_AI_API_KEY as a Cloudflare Workers Secret (not a plain Variable).",
      "Redeploy after adding secrets.",
      "On Ask Oscar results, check Multi-model section: Live Gemini calls should be > 0.",
      "Per-claim panels should not say heuristic / offline for Gemini when configured.",
    ],
    likelyOfflineReason: !googleKeyPresent
      ? "No Google API key visible to the Worker runtime."
      : user.multiModelEnabled
        ? "Keys may be set but Gemini HTTP failed (model name, quota, or API error) — check Worker logs."
        : "MULTI_MODEL_VERIFICATION_ENABLED=false or no provider keys detected.",
  };
}
