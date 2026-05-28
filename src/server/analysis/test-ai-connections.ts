import { getGoogleAiApiKey } from "../ai/google-api-key";
import { geminiGenerateContent } from "../ai/gemini-client";
import { getServerEnv, isOpenAiConfigured } from "../env/server-env";
import { listApiKeyEnvNames, captureWorkerEnvSnapshot } from "../env/server-env";
import { ensureWorkerEnvFromPlatform } from "../env/ensure-worker-env";
import { fetchWithTimeout } from "../utils/fetch-timeout";

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

  const openaiKey = getServerEnv("OPENAI_API_KEY") ?? getServerEnv("OPENAI_KEYS");
  if (openaiKey) {
    try {
      const res = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 20,
            messages: [{ role: "user", content: "Say OK" }],
          }),
        },
        12_000,
      );
      out.openaiLiveTest = { ok: res.ok, status: res.status };
    } catch (e) {
      out.openaiLiveTest = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return out;
}
