import type { ModelProviderId, Verdict } from "@/types/news-platform";
import { getGoogleAiApiKey, isGoogleAiConfigured } from "../ai/google-api-key";
import { getServerEnv, isOpenAiConfigured, isServerEnvFalse, isServerEnvTruthy } from "../env/server-env";

export const MODEL_WEIGHTS = {
  primary: 0.45,
  review: 0.38,
  corroboration: 0.17,
} as const;

export const REVIEW_CONFIDENCE_THRESHOLD = 58;

export const REVIEW_VERDICTS: Verdict[] = ["disputed", "unclear", "insufficient_evidence"];

export const DISAGREEMENT_CONFIDENCE_SPREAD = 22;

export function isMultiModelEnabled(forTrigger: "user" | "scheduled" = "user"): boolean {
  if (isServerEnvFalse("MULTI_MODEL_VERIFICATION_ENABLED")) return false;
  if (forTrigger === "scheduled" && isServerEnvFalse("SCHEDULED_USE_MULTI_MODEL")) {
    return false;
  }
  // User + scheduled feed analysis always run multi-model when not explicitly disabled.
  if (forTrigger === "user" || forTrigger === "scheduled") return true;
  return (
    isOpenAiConfigured() ||
    isServerEnvTruthy("ANTHROPIC_API_KEY") ||
    isGoogleAiConfigured() ||
    getServerEnv("MULTI_MODEL_VERIFICATION_ENABLED") === "true"
  );
}

export function availableProviders(): ModelProviderId[] {
  const out: ModelProviderId[] = [];
  if (isOpenAiConfigured()) out.push("openai");
  if (isServerEnvTruthy("ANTHROPIC_API_KEY")) out.push("anthropic");
  if (isGoogleAiConfigured()) out.push("google");
  return out;
}

export function isGeminiLiveEnabled(): boolean {
  return isGoogleAiConfigured();
}
