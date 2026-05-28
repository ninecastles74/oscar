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

export async function geminiGenerateContent(options: {
  user: string;
  system?: string;
  useGoogleSearch?: boolean;
  jsonMode?: boolean;
  model?: string;
  timeoutMs?: number;
}): Promise<GeminiGenerateResult | null> {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) return null;

  const model = options.model ?? geminiVerificationModel();
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
      console.warn("[gemini-client]", res.status, data.error?.message ?? "");
      return null;
    }

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";
    if (!text) return null;

    return {
      text,
      grounding: candidate?.groundingMetadata,
      totalTokens: data.usageMetadata?.totalTokenCount,
      model: options.useGoogleSearch ? `${model}+google_search` : model,
    };
  } catch (err) {
    console.warn("[gemini-client] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function groundingToSourceList(grounding?: GeminiGroundingMetadata) {
  return (grounding?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);
}
