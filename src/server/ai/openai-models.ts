import { getServerEnv } from "../env/server-env";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export function resolveOpenAiVerificationModel(): string {
  return (
    getServerEnv("OPENAI_VERIFICATION_MODEL")?.trim() ||
    getServerEnv("OPENAI_TOPIC_MODEL")?.trim() ||
    OPENAI_DEFAULT_MODEL
  );
}

export function resolveOpenAiTopicModel(): string {
  return getServerEnv("OPENAI_TOPIC_MODEL")?.trim() || OPENAI_DEFAULT_MODEL;
}
