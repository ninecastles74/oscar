import { getGoogleAiApiKey } from "./google-api-key";
import { geminiModelCandidates } from "./gemini-models";
import { parseRetryAfterSeconds, withGeminiRateLimit } from "./gemini-rate-limit";
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
const MAX_429_RETRIES = Number(getServerEnv("GEMINI_429_MAX_RETRIES")) || 4;

let lastGeminiError: string | undefined;
let lastGeminiAttemptLog: string[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getLastGeminiError(): string | undefined {
  return lastGeminiError;
}

export function getLastGeminiAttemptLog(): string[] {
  return [...lastGeminiAttemptLog];
}

export function clearLastGeminiError(): void {
  lastGeminiError = undefined;
  lastGeminiAttemptLog = [];
}

export { geminiModelCandidates } from "./gemini-models";

function needsV1Beta(options: {
  system?: string;
  useGoogleSearch?: boolean;
  jsonMode?: boolean;
}): boolean {
  return !!(options.system || options.useGoogleSearch || options.jsonMode);
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

  return withGeminiRateLimit(async () => {
    const models = options.model ? [options.model] : geminiModelCandidates();
    lastGeminiError = undefined;
    lastGeminiAttemptLog = [];

    const apiVersions: Array<"v1beta" | "v1"> = needsV1Beta(options)
      ? ["v1beta"]
      : ["v1beta", "v1"];

    for (const model of models) {
      for (const apiVersion of apiVersions) {
        const result = await geminiGenerateContentOnce(apiKey, model, apiVersion, options);
        if (result) return result;
      }
    }

    if (lastGeminiAttemptLog.some((m) => m.includes("HTTP 429"))) {
      lastGeminiError =
        `Gemini free-tier rate limit exceeded. ${lastGeminiAttemptLog.join("; ")} ` +
        "Enable billing at https://ai.google.dev or wait a minute and retry.";
    } else if (lastGeminiAttemptLog.length > 0) {
      lastGeminiError = `All models failed. ${lastGeminiAttemptLog.join("; ")}`;
    }
    return null;
  });
}

async function geminiGenerateContentOnce(
  apiKey: string,
  model: string,
  apiVersion: "v1beta" | "v1",
  options: {
    user: string;
    system?: string;
    useGoogleSearch?: boolean;
    jsonMode?: boolean;
    timeoutMs?: number;
  },
): Promise<GeminiGenerateResult | null> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent`;

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

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
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

      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        const errMsg = data.error?.message ?? "";
        const waitSec = parseRetryAfterSeconds(errMsg) ?? 18;
        console.warn(`[gemini-client] 429 on ${model}, retry in ${waitSec}s`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const msg = `${model}@${apiVersion}: HTTP ${res.status} ${data.error?.message ?? ""}`.trim();
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";
      if (!text) {
        const msg = `${model}@${apiVersion}: empty response`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      return {
        text,
        grounding: candidate?.groundingMetadata,
        totalTokens: data.usageMetadata?.totalTokenCount,
        model: options.useGoogleSearch ? `${model}+google_search` : model,
      };
    } catch (err) {
      const msg = `${model}@${apiVersion}: ${err instanceof Error ? err.message : String(err)}`;
      lastGeminiAttemptLog.push(msg);
      lastGeminiError = msg;
      console.warn("[gemini-client] failed:", msg);
      return null;
    }
  }

  return null;
}

export function groundingToSourceList(grounding?: GeminiGroundingMetadata) {
  return (grounding?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);
}
