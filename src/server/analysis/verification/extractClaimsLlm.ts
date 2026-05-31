import type { ExtractedClaim } from "./types";
import { getGoogleAiApiKey } from "../../ai/google-api-key";
import { getServerEnv } from "../../env/server-env";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { geminiVerificationModel } from "../../ai/google-api-key";

const TIMEOUT_MS = 20_000;

interface ClaimsPayload {
  claims?: { text: string }[];
}

const maxExtractedClaims = () =>
  Number(getServerEnv("LIVE_EVIDENCE_MAX_CLAIMS")) || 8;

function parseClaims(raw: string, prefixId: string): ExtractedClaim[] | null {
  try {
    const parsed = JSON.parse(raw) as ClaimsPayload;
    const maxClaims = maxExtractedClaims();
    const list = parsed.claims?.filter((c) => c.text?.trim()).slice(0, maxClaims) ?? [];
    if (list.length === 0) return null;
    return list.map((c, i) => ({
      id: `${prefixId}-claim-${i + 1}`,
      text: c.text.trim().slice(0, 320),
    }));
  } catch {
    const match = raw.match(/\{[\s\S]*"claims"[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as ClaimsPayload;
      const maxClaims = maxExtractedClaims();
      const list = parsed.claims?.filter((c) => c.text?.trim()).slice(0, maxClaims) ?? [];
      if (list.length === 0) return null;
      return list.map((c, i) => ({
        id: `${prefixId}-claim-${i + 1}`,
        text: c.text.trim().slice(0, 320),
      }));
    } catch {
      return null;
    }
  }
}

async function extractWithOpenAI(articleText: string, prefixId: string): Promise<ExtractedClaim[] | null> {
  const apiKey = getServerEnv("OPENAI_API_KEY") ?? getServerEnv("OPENAI_KEYS");
  if (!apiKey) return null;
  const model = getServerEnv("OPENAI_TOPIC_MODEL") ?? "gpt-4o-mini";
  const system =
    'Extract 5-10 factual, verifiable claims from the article. Return JSON only: {"claims":[{"text":"..."}]}';
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: articleText.slice(0, 12_000) },
          ],
        }),
      },
      TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    return parseClaims(raw, prefixId);
  } catch {
    return null;
  }
}

async function extractWithGemini(articleText: string, prefixId: string): Promise<ExtractedClaim[] | null> {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) return null;
  const model = geminiVerificationModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const prompt =
    'Extract 5-10 factual, verifiable claims from this article. Return JSON only: {"claims":[{"text":"..."}]}\n\n' +
    articleText.slice(0, 12_000);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      },
      TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ?? "";
    if (!raw) return null;
    return parseClaims(raw, prefixId);
  } catch {
    return null;
  }
}

/** Live LLM claim extraction when OpenAI or Gemini is configured. */
export async function extractClaimsWithLlm(
  articleText: string,
  prefixId: string,
): Promise<ExtractedClaim[] | null> {
  const openai = await extractWithOpenAI(articleText, prefixId);
  if (openai?.length) return openai;
  return extractWithGemini(articleText, prefixId);
}
