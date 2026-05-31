import { getLastAnthropicError, verifyClaimWithAnthropic } from "../multi-model/providers/anthropic";
import { getGoogleAiApiKey } from "../ai/google-api-key";
import { geminiGenerateContent } from "../ai/gemini-client";
import { openAiChatCompletion } from "../ai/openai-client";
import { resolveOpenAiTopicModel } from "../ai/openai-models";
import { getServerEnv, isOpenAiConfigured, listApiKeyEnvNames, captureWorkerEnvSnapshot } from "../env/server-env";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";

export async function testAiConnections() {
  ensureWorkerEnvFromPlatform();
  const snap = captureWorkerEnvSnapshot();
  const keys = listApiKeyEnvNames(snap);

  const out: Record<string, unknown> = {
    detectedKeyNames: keys,
    geminiKeyPresent: !!getGoogleAiApiKey(),
    openaiKeyPresent: isOpenAiConfigured(),
    anthropicKeyPresent: !!getServerEnv("ANTHROPIC_API_KEY"),
  };

  const gemini = await geminiGenerateContent({
    user: 'Reply with JSON only: {"ok":true,"message":"gemini live"}',
    jsonMode: true,
  });
  out.geminiLiveTest = gemini
    ? { ok: true, model: gemini.model, tokens: gemini.totalTokens }
    : { ok: false, error: "Gemini call failed — check key, model, and Worker logs" };

  if (isOpenAiConfigured()) {
    const raw = await openAiChatCompletion({
      model: resolveOpenAiTopicModel(),
      user: "Say OK",
      maxTokens: 20,
      temperature: 0,
    });
    out.openaiLiveTest = raw
      ? { ok: true, preview: raw.slice(0, 40) }
      : { ok: false, error: "OpenAI call failed" };
  }

  if (getServerEnv("ANTHROPIC_API_KEY")) {
    const review = await verifyClaimWithAnthropic({
      claimId: "test-claim",
      claimText: "The sky is blue on a clear day.",
      evidence: [
        {
          stance: "support",
          sourceName: "Test",
          excerpt: "On clear days the sky appears blue due to Rayleigh scattering.",
        },
      ],
      role: "review",
      priorVerdict: {
        verdict: "supported",
        confidence: 72,
        reasoning: "Initial pass.",
      },
    });
    out.anthropicLiveTest = review
      ? { ok: true, model: review.model, verdict: review.verdict }
      : { ok: false, error: getLastAnthropicError() ?? "Anthropic call failed" };
  }

  return out;
}
