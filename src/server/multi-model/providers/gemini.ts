import type { ModelClaimVerdict } from "@/types/news-platform";
import {
  geminiVerificationModel,
  getGoogleAiApiKey,
  isGeminiGoogleSearchEnabled,
} from "../../ai/google-api-key";
import { getServerEnv } from "../../env/server-env";
import { clampScore } from "../../reliability/utils/math";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const LLM_TIMEOUT_MS = Number(getServerEnv("GEMINI_FETCH_TIMEOUT_MS")) || 25_000;

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: GeminiGroundingMetadata;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
}

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
  data: GeminiApiResponse,
  grounding: GeminiGroundingMetadata | undefined,
  searchEnabled: boolean,
): ModelClaimVerdict["geminiMeta"] {
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
    promptTokens: data.usageMetadata?.promptTokenCount,
    completionTokens: data.usageMetadata?.candidatesTokenCount,
    totalTokens: data.usageMetadata?.totalTokenCount,
  };
}

/**
 * Gemini corroboration with optional Google Search grounding (real-time web).
 */
export async function verifyClaimWithGemini(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) return null;

  const model = geminiVerificationModel();
  const useGoogleSearch =
    input.role === "corroboration" && isGeminiGoogleSearchEnabled();

  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  const userPrompt = useGoogleSearch
    ? `${user}\n\nUse Google Search when the claim needs current public facts. End with a single JSON object only: {"verdict":"supported|disputed|unclear|insufficient_evidence","confidence":0-100,"reasoning":"..."}`
    : user;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.05,
      ...(useGoogleSearch ? {} : { responseMimeType: "application/json" }),
    },
  };

  if (useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      LLM_TIMEOUT_MS,
    );

    const data = (await res.json()) as GeminiApiResponse;

    if (!res.ok) {
      console.warn(
        "[gemini] API error:",
        res.status,
        data.error?.message ?? JSON.stringify(data).slice(0, 200),
      );
      return null;
    }

    const candidate = data.candidates?.[0];
    const raw = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";
    if (!raw) {
      console.warn("[gemini] empty candidate text");
      return null;
    }

    const parsed = extractJsonVerdict(raw);
    if (!parsed || !VALID_VERDICTS.has(parsed.verdict)) {
      console.warn("[gemini] invalid verdict JSON:", raw.slice(0, 120));
      return null;
    }

    const grounding = candidate?.groundingMetadata;

    return {
      provider: "google",
      model: useGoogleSearch ? `${model}+google_search` : model,
      role: input.role,
      verdict: parsed.verdict,
      confidence: clampScore(Number(parsed.confidence) || 50),
      reasoning: String(parsed.reasoning ?? "").slice(0, 500),
      geminiMeta: buildGeminiMeta(data, grounding, useGoogleSearch),
    };
  } catch (err) {
    console.warn(
      "[gemini] request failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
