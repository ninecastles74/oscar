import { getServerEnv } from "../env/server-env";

/** Fast reviewer for uncertain / disputed claims. */
export const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export const ANTHROPIC_MODEL_FALLBACKS = [
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
] as const;

export function resolveAnthropicVerificationModel(): string {
  const fromEnv = getServerEnv("ANTHROPIC_VERIFICATION_MODEL")?.trim();
  return fromEnv || ANTHROPIC_DEFAULT_MODEL;
}

export function anthropicModelCandidates(override?: string): string[] {
  const primary = override?.trim() || resolveAnthropicVerificationModel();
  return [...new Set([primary, ...ANTHROPIC_MODEL_FALLBACKS].filter(Boolean))];
}
