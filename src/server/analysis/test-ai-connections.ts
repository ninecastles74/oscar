import { getLastAnthropicError, verifyClaimWithAnthropic } from "../multi-model/providers/anthropic";
import {
  getGoogleAiApiKey,
  getGoogleAiApiKeyMeta,
  getGoogleAiKeyInvalidHint,
} from "../ai/google-api-key";
import { geminiGenerateContent, getLastGeminiError } from "../ai/gemini-client";
import { openAiChatCompletion } from "../ai/openai-client";
import { resolveOpenAiTopicModel } from "../ai/openai-models";
import { getServerEnv, isOpenAiConfigured, listApiKeyEnvNames, captureWorkerEnvSnapshot } from "../env/server-env";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";

export async function testAiConnections() {
  ensureWorkerEnvFromPlatform();
  const snap = captureWorkerEnvSnapshot();
  const keys = listApiKeyEnvNames(snap);
  const keyMeta = getGoogleAiApiKeyMeta();

  const out: Record<string, unknown> = {
    detectedKeyNames: keys,
    geminiKeyPresent: !!getGoogleAiApiKey(),
    geminiKeySource: keyMeta?.source,
    geminiKeyLength: keyMeta?.key.length,
    geminiKeyPrefix: keyMeta?.key.slice(0, 8),
    openaiKeyPresent: isOpenAiConfigured(),
    anthropicKeyPresent: !!getServerEnv("ANTHROPIC_API_KEY"),
  };

  const geminiJson = await geminiGenerateContent({
    user: 'Reply with JSON only: {"ok":true,"message":"gemini live"}',
    jsonMode: true,
  });
  out.geminiJsonTest = geminiJson
    ? { ok: true, model: geminiJson.model, tokens: geminiJson.totalTokens }
    : { ok: false, error: getLastGeminiError() ?? "Gemini JSON test failed" };

  const geminiSearch = await geminiGenerateContent({
    user: "What is 2+2? One word answer.",
    useGoogleSearch: true,
  });
  out.geminiSearchTest = geminiSearch
    ? { ok: true, model: geminiSearch.model, searchQueries: geminiSearch.grounding?.webSearchQueries?.length ?? 0 }
    : { ok: false, error: getLastGeminiError() ?? "Gemini Google Search test failed" };

  if (!geminiJson && keyMeta) {
    out.geminiKeyHelp = getGoogleAiKeyInvalidHint(keyMeta.source);
  }

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
