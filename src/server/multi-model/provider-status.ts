import {
  geminiVerificationModel,
  getGoogleAiApiKey,
  isGeminiGoogleSearchEnabled,
  isGoogleAiConfigured,
} from "../ai/google-api-key";
import { isOpenAiConfigured, isServerEnvFalse, isServerEnvTruthy } from "../env/server-env";
import { availableProviders, isMultiModelEnabled } from "./config";

export interface MultiModelProviderStatus {
  multiModelEnabled: boolean;
  trigger: "user" | "scheduled";
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  googleConfigured: boolean;
  googleKeyEnvHint: string;
  geminiGoogleSearchEnabled: boolean;
  geminiVerificationModel: string;
  providersAvailable: ReturnType<typeof availableProviders>;
  scheduledMultiModelExplicitlyDisabled: boolean;
}

export function getMultiModelProviderStatus(
  trigger: "user" | "scheduled" = "user",
): MultiModelProviderStatus {
  return {
    multiModelEnabled: isMultiModelEnabled(trigger),
    trigger,
    openaiConfigured: isOpenAiConfigured(),
    anthropicConfigured: isServerEnvTruthy("ANTHROPIC_API_KEY"),
    googleConfigured: isGoogleAiConfigured(),
    googleKeyEnvHint: getGoogleAiApiKey()
      ? "configured"
      : "set GOOGLE_AI_API_KEY or GEMINI_API_KEY (Workers secret)",
    geminiGoogleSearchEnabled: isGeminiGoogleSearchEnabled(),
    geminiVerificationModel: geminiVerificationModel(),
    providersAvailable: availableProviders(),
    scheduledMultiModelExplicitlyDisabled:
      trigger === "scheduled" && isServerEnvFalse("SCHEDULED_USE_MULTI_MODEL"),
  };
}
