import { getGoogleAiApiKey, getGoogleAiKeyInvalidHint, getGoogleAiKeySetupHint, getGoogleAiApiKeyMeta } from "./google-api-key";
import { geminiModelCandidates } from "./gemini-models";
import { extractGoogleApiKey, sanitizeGoogleApiKeyOrUndefined } from "./sanitize-api-secret";
import { parseRetryAfterSeconds, withGeminiRateLimit } from "./gemini-rate-limit";
import { getServerEnv } from "../env/server-env";

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

const GEMINI_CLIENT_VERSION = "2026-05-20-v4";

async function geminiFetch(url: string, body: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Isolated Request — do not forward browser/worker headers (avoids Invalid header value).
    const request = new Request(url, {
      method: "POST",
      headers: new Headers([["content-type", "application/json"]]),
      body,
      signal: controller.signal,
    });
    return await fetch(request);
  } finally {
    clearTimeout(timer);
  }
}

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
  const keyMeta = getGoogleAiApiKeyMeta();
  if (!apiKey) {
    lastGeminiError = getGoogleAiKeySetupHint() ?? "No valid Gemini API key.";
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
        const result = await geminiGenerateContentOnce(apiKey, model, apiVersion, options, keyMeta?.source);
        if (result) return result;
        if (lastGeminiError?.includes("Google rejected the API key")) break;
      }
      if (lastGeminiError?.includes("Google rejected the API key")) break;
    }

    if (lastGeminiAttemptLog.some((m) => m.includes("HTTP 429"))) {
      lastGeminiError =
        `Gemini free-tier rate limit exceeded. ${lastGeminiAttemptLog.join("; ")} ` +
        "Enable billing at https://ai.google.dev or wait a minute and retry.";
    } else if (lastGeminiAttemptLog.length > 0) {
      lastGeminiError = `All models failed. ${lastGeminiAttemptLog.join("; ")}`;
    }
    return null;
  }, { usesGoogleSearch: !!options.useGoogleSearch });
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
  keySource?: string,
): Promise<GeminiGenerateResult | null> {
  const cleanedKey = sanitizeGoogleApiKeyOrUndefined(apiKey) ?? extractGoogleApiKey(apiKey);
  if (!cleanedKey) {
    const msg = `${model}@${apiVersion}: ${getGoogleAiKeySetupHint() ?? "Invalid Gemini API key format."} [${GEMINI_CLIENT_VERSION}]`;
    lastGeminiAttemptLog.push(msg);
    lastGeminiError = msg;
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cleanedKey)}`;

  const body: Record<string, unknown> = {
    ...(options.system
      ? { systemInstruction: { parts: [{ text: options.system }] } }
      : {}),
    contents: [{ role: "user", parts: [{ text: options.user }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      ...(options.useGoogleSearch || !options.jsonMode
        ? {}
        : { responseMimeType: "application/json" }),
    },
  };

  if (options.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  const bodyJson = JSON.stringify(body);

  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    try {
      const res = await geminiFetch(url, bodyJson, options.timeoutMs ?? DEFAULT_TIMEOUT);

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
          groundingMetadata?: GeminiGroundingMetadata;
        }>;
        usageMetadata?: { totalTokenCount?: number };
        error?: { message?: string };
        promptFeedback?: { blockReason?: string };
      };

      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        const errMsg = data.error?.message ?? "";
        const waitSec = parseRetryAfterSeconds(errMsg) ?? 18;
        console.warn(`[gemini-client] 429 on ${model}, retry in ${waitSec}s`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!res.ok) {
        const apiMsg = data.error?.message ?? "";
        const invalidKey =
          res.status === 400 &&
          /api key not valid|API_KEY_INVALID|invalid api key/i.test(apiMsg);
        const msg = invalidKey
          ? `${model}@${apiVersion}: ${getGoogleAiKeyInvalidHint(keySource)}`
          : `${model}@${apiVersion}: HTTP ${res.status} ${apiMsg}`.trim();
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      if (data.promptFeedback?.blockReason) {
        const msg = `${model}@${apiVersion}: blocked (${data.promptFeedback.blockReason})`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      const candidate = data.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
        const msg = `${model}@${apiVersion}: finishReason=${finishReason}`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

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
      const errMsg = err instanceof Error ? err.message : String(err);
      const hint =
        errMsg.includes("Invalid header value")
          ? ` — redeploy Oscar (need client ${GEMINI_CLIENT_VERSION}), then re-save GEMINI_API_KEY with only AIza… in Cloudflare Secrets`
          : "";
      const msg = `${model}@${apiVersion}: ${errMsg}${hint} [${GEMINI_CLIENT_VERSION}]`;
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
