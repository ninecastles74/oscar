import type { ModelProviderId, Verdict } from "@/types/news-platform";
import { getGoogleAiApiKey, isGoogleAiConfigured } from "../ai/google-api-key";
import { getServerEnv, isServerEnvFalse, isServerEnvTruthy } from "../env/server-env";

export const MODEL_WEIGHTS = {
  primary: 0.45,
  review: 0.38,
  corroboration: 0.17,
} as const;

/** Claims below this confidence (after primary) trigger Claude review. */
export const REVIEW_CONFIDENCE_THRESHOLD = 58;

export const REVIEW_VERDICTS: Verdict[] = ["disputed", "unclear", "insufficient_evidence"];

export const DISAGREEMENT_CONFIDENCE_SPREAD = 22;

export function isMultiModelEnabled(forTrigger: "user" | "scheduled" = "user"): boolean {
  if (forTrigger === "scheduled" && isServerEnvFalse("SCHEDULED_USE_MULTI_MODEL")) {
    return false;
  }
  if (isServerEnvFalse("MULTI_MODEL_VERIFICATION_ENABLED")) return false;
  return (
    isServerEnvTruthy("OPENAI_API_KEY") ||
    isServerEnvTruthy("ANTHROPIC_API_KEY") ||
    isGoogleAiConfigured() ||
    getServerEnv("MULTI_MODEL_VERIFICATION_ENABLED") === "true"
  );
}

export function availableProviders(): ModelProviderId[] {
  const out: ModelProviderId[] = [];
  if (isServerEnvTruthy("OPENAI_API_KEY")) out.push("openai");
  if (isServerEnvTruthy("ANTHROPIC_API_KEY")) out.push("anthropic");
  if (isGoogleAiConfigured()) out.push("google");
  return out;
}

/** True when a live Gemini corroboration call should run (not heuristic-only). */
export function isGeminiLiveEnabled(): boolean {
  return isGoogleAiConfigured();
}
