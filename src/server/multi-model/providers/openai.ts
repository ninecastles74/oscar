import type { ModelClaimVerdict } from "@/types/news-platform";
import { openAiChatCompletion } from "../../ai/openai-client";
import { VERDICT_JSON_SCHEMA } from "../../ai/llm-schemas";
import { resolveOpenAiVerificationModel } from "../../ai/openai-models";
import { getServerEnv } from "../../env/server-env";
import { clampScore } from "../../reliability/utils/math";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

export async function verifyClaimWithOpenAI(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const model = resolveOpenAiVerificationModel();
  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  const raw = await openAiChatCompletion({
    model,
    system,
    user,
    temperature: input.role === "corroboration" ? 0.05 : 0.15,
    maxTokens: 512,
    jsonSchema: VERDICT_JSON_SCHEMA,
    jsonSchemaName: "claim_verdict",
    timeoutMs: Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 20_000,
  });

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LlmVerdictPayload;
    if (!VALID_VERDICTS.has(parsed.verdict)) return null;

    return {
      provider: "openai",
      model,
      role: input.role,
      verdict: parsed.verdict,
      confidence: clampScore(Number(parsed.confidence) || 50),
      reasoning: String(parsed.reasoning ?? "").slice(0, 500),
    };
  } catch {
    return null;
  }
}
