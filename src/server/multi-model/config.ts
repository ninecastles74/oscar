import type { ModelProviderId, Verdict } from "@/types/news-platform";
import { getGoogleAiApiKey, isGoogleAiConfigured } from "../ai/google-api-key";

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
  if (forTrigger === "scheduled" && process.env.SCHEDULED_USE_MULTI_MODEL === "false") {
    return false;
  }
  if (process.env.MULTI_MODEL_VERIFICATION_ENABLED === "false") return false;
  return (
    !!process.env.OPENAI_API_KEY?.trim() ||
    !!process.env.ANTHROPIC_API_KEY?.trim() ||
    isGoogleAiConfigured() ||
    process.env.MULTI_MODEL_VERIFICATION_ENABLED === "true"
  );
}

export function availableProviders(): ModelProviderId[] {
  const out: ModelProviderId[] = [];
  if (process.env.OPENAI_API_KEY?.trim()) out.push("openai");
  if (process.env.ANTHROPIC_API_KEY?.trim()) out.push("anthropic");
  if (isGoogleAiConfigured()) out.push("google");
  return out;
}

/** True when a live Gemini corroboration call should run (not heuristic-only). */
export function isGeminiLiveEnabled(): boolean {
  return isGoogleAiConfigured();
}
