import { geminiVerificationModel, getGoogleAiApiKey } from "./google-api-key";
import { getServerEnv } from "../env/server-env";
import { fetchWithTimeout } from "../utils/fetch-timeout";

export interface GeminiGroundingChunk {
  web?: { title?: string; uri?: string };
}

export interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: GeminiGroundingChunk[];
}

export interface GeminiGenerateResult {
  text: string;
  grounding?: GeminiGroundingMetadata;
  totalTokens?: number;
  model: string;
}

const DEFAULT_TIMEOUT = Number(getServerEnv("GEMINI_FETCH_TIMEOUT_MS")) || 28_000;

let lastGeminiError: string | undefined;

export function getLastGeminiError(): string | undefined {
  return lastGeminiError;
}

export function clearLastGeminiError(): void {
  lastGeminiError = undefined;
}

export function geminiModelCandidates(): string[] {
  const primary = geminiVerificationModel();
  const fallbacks = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  return [...new Set([primary, ...fallbacks].filter(Boolean))];
}

export async function geminiGenerateContent(options: {
  user: string;
  system?: string;
  useGoogleSearch?: boolean;
  jsonMode?: boolean;
  model?: string;
  timeoutMs?: number;
}): Promise<GeminiGenerateResult | null> {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) {
    lastGeminiError = "No Gemini API key";
    return null;
  }

  const models = options.model ? [options.model] : geminiModelCandidates();
  lastGeminiError = undefined;

  for (const model of models) {
    const result = await geminiGenerateContentOnce(apiKey, model, options);
    if (result) return result;
  }

  return null;
}

async function geminiGenerateContentOnce(
  apiKey: string,
  model: string,
  options: {
    user: string;
    system?: string;
    useGoogleSearch?: boolean;
    jsonMode?: boolean;
    timeoutMs?: number;
  },
): Promise<GeminiGenerateResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body: Record<string, unknown> = {
    ...(options.system
      ? { systemInstruction: { parts: [{ text: options.system }] } }
      : {}),
    contents: [{ role: "user", parts: [{ text: options.user }] }],
    generationConfig: {
      temperature: 0.1,
      ...(options.useGoogleSearch || !options.jsonMode
        ? {}
        : { responseMimeType: "application/json" }),
    },
  };

  if (options.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT,
    );

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: GeminiGroundingMetadata;
      }>;
      usageMetadata?: { totalTokenCount?: number };
      error?: { message?: string };
    };

    if (!res.ok) {
      lastGeminiError = `${model}: HTTP ${res.status} ${data.error?.message ?? ""}`.trim();
      console.warn("[gemini-client]", lastGeminiError);
      return null;
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";
    if (!text) {
      lastGeminiError = `${model}: empty response`;
      console.warn("[gemini-client]", lastGeminiError);
      return null;
    }

    return {
      text,
      grounding: candidate?.groundingMetadata,
      totalTokens: data.usageMetadata?.totalTokenCount,
      model: options.useGoogleSearch ? `${model}+google_search` : model,
    };
  } catch (err) {
    lastGeminiError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
    console.warn("[gemini-client] failed:", lastGeminiError);
    return null;
  }
}

export function groundingToSourceList(grounding?: GeminiGroundingMetadata) {
  return (grounding?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);
}
