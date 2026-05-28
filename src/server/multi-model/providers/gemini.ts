import type { ModelClaimVerdict } from "@/types/news-platform";
import { isGeminiGoogleSearchEnabled } from "../../ai/google-api-key";
import { geminiGenerateContent } from "../../ai/gemini-client";
import { clampScore } from "../../reliability/utils/math";
import { getServerEnv } from "../../env/server-env";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const LLM_TIMEOUT_MS = Number(getServerEnv("GEMINI_FETCH_TIMEOUT_MS")) || 25_000;

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

function extractJsonVerdict(raw: string): LlmVerdictPayload | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as LlmVerdictPayload;
  } catch {
    const match = trimmed.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as LlmVerdictPayload;
    } catch {
      return null;
    }
  }
}

function buildGeminiMeta(
  result: Awaited<ReturnType<typeof geminiGenerateContent>>,
  searchEnabled: boolean,
): ModelClaimVerdict["geminiMeta"] {
  const grounding = result?.grounding;
  const queries = grounding?.webSearchQueries ?? [];
  const chunks = grounding?.groundingChunks ?? [];
  const sourcesUsed = chunks
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);

  return {
    liveApiCalled: true,
    searchPerformed: searchEnabled && queries.length > 0,
    searchQueryCount: queries.length,
    webSearchQueries: queries.slice(0, 6),
    sourcesUsed,
    totalTokens: result?.totalTokens,
  };
}

/** Gemini corroboration with optional Google Search grounding (real-time web). */
export async function verifyClaimWithGemini(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const useGoogleSearch =
    input.role === "corroboration" && isGeminiGoogleSearchEnabled();

  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  const userPrompt = useGoogleSearch
    ? `${user}\n\nUse Google Search when the claim needs current public facts. End with a single JSON object only: {"verdict":"supported|disputed|unclear|insufficient_evidence","confidence":0-100,"reasoning":"..."}`
    : user;

  const result = await geminiGenerateContent({
    system,
    user: userPrompt,
    useGoogleSearch,
    jsonMode: !useGoogleSearch,
    timeoutMs: LLM_TIMEOUT_MS,
  });

  if (!result) return null;

  const parsed = extractJsonVerdict(result.text);
  if (!parsed || !VALID_VERDICTS.has(parsed.verdict)) {
    console.warn("[gemini] invalid verdict JSON:", result.text.slice(0, 120));
    return null;
  }

  return {
    provider: "google",
    model: result.model,
    role: input.role,
    verdict: parsed.verdict,
    confidence: clampScore(Number(parsed.confidence) || 50),
    reasoning: String(parsed.reasoning ?? "").slice(0, 500),
    geminiMeta: buildGeminiMeta(result, useGoogleSearch),
  };
}
