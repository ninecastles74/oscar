import type { ExtractedClaim } from "./types";
import { geminiGenerateContent } from "../../ai/gemini-client";
import { CLAIMS_JSON_SCHEMA } from "../../ai/llm-schemas";
import { openAiChatCompletion } from "../../ai/openai-client";
import { resolveOpenAiTopicModel } from "../../ai/openai-models";
import { getServerEnv } from "../../env/server-env";
import { isOpenAiConfigured } from "../../env/server-env";

interface ClaimsPayload {
  claims?: { text: string }[];
}

const maxExtractedClaims = () =>
  Number(getServerEnv("LIVE_EVIDENCE_MAX_CLAIMS")) || 5;

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
  if (!isOpenAiConfigured()) return null;

  const model = resolveOpenAiTopicModel();
  const raw = await openAiChatCompletion({
    model,
    system:
      "Extract 5-10 factual, verifiable claims from the article. Each claim must be a standalone sentence that can be fact-checked.",
    user: articleText.slice(0, 12_000),
    temperature: 0.1,
    maxTokens: 2048,
    jsonSchema: CLAIMS_JSON_SCHEMA,
    jsonSchemaName: "extracted_claims",
  });

  if (!raw) return null;
  return parseClaims(raw, prefixId);
}

async function extractWithGemini(articleText: string, prefixId: string): Promise<ExtractedClaim[] | null> {
  const result = await geminiGenerateContent({
    system:
      "Extract 5-10 factual, verifiable claims from the article. Each claim must be a standalone sentence that can be fact-checked.",
    user: articleText.slice(0, 12_000),
    jsonMode: true,
  });

  if (!result?.text) return null;
  return parseClaims(result.text, prefixId);
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
