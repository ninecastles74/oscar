import { getGoogleAiApiKey, getGoogleAiKeyInvalidHint, getGoogleAiKeySetupHint, getGoogleAiApiKeyMeta } from "./google-api-key";
import { geminiModelCandidates } from "./gemini-models";
import { extractGoogleApiKey, sanitizeGoogleApiKeyOrUndefined } from "./sanitize-api-secret";
import { parseRetryAfterSeconds, withGeminiRateLimit } from "./gemini-rate-limit";
import { getServerEnv } from "../env/server-env";
import {
  isGeminiCapacityHttpError,
  noteGeminiCapacityFailure,
  noteGeminiFallbackUsed,
} from "./gemini-resilience";

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
const MAX_503_RETRIES = Number(getServerEnv("GEMINI_503_MAX_RETRIES")) || 3;
const BASE_503_BACKOFF_MS = Number(getServerEnv("GEMINI_503_BACKOFF_MS")) || 2000;

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

const GEMINI_CLIENT_VERSION = "2026-05-20-v6";

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
        if (result) {
          if (model !== models[0]) {
            noteGeminiFallbackUsed(model);
          }
          return result;
        }
        if (lastGeminiError?.includes("Google rejected the API key")) break;
      }
      if (lastGeminiError?.includes("Google rejected the API key")) break;
    }

    if (lastGeminiAttemptLog.some((m) => m.includes("HTTP 503") || m.includes("high demand"))) {
      lastGeminiError =
        "Gemini is experiencing high demand. Retries and fallback models were attempted; analysis may continue with degraded web evidence.";
    } else if (lastGeminiAttemptLog.some((m) => m.includes("HTTP 429"))) {
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
      maxOutputTokens: options.useGoogleSearch ? 4096 : 2048,
      ...(model.includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      ...(options.useGoogleSearch || !options.jsonMode
        ? {}
        : { responseMimeType: "application/json" }),
    },
  };

  if (options.useGoogleSearch) {
    body.tools = [{ google_search: {} }];
  }

  const bodyJson = JSON.stringify(body);

  let retries503 = 0;
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

      const apiMsg = data.error?.message ?? "";

      if (res.status === 429 && attempt < MAX_429_RETRIES) {
        const waitSec = parseRetryAfterSeconds(apiMsg) ?? 18;
        console.warn(`[gemini-client] 429 on ${model}@${apiVersion}, retry in ${waitSec}s`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (isGeminiCapacityHttpError(res.status, apiMsg) && retries503 < MAX_503_RETRIES) {
        retries503 += 1;
        const backoff = BASE_503_BACKOFF_MS * 2 ** (retries503 - 1);
        const adminLine = `${model}@${apiVersion}: HTTP ${res.status} ${apiMsg}`.trim();
        noteGeminiCapacityFailure(adminLine);
        console.warn(
          `[gemini-client] capacity error on ${model}@${apiVersion}, retry ${retries503}/${MAX_503_RETRIES} in ${backoff}ms`,
        );
        lastGeminiAttemptLog.push(adminLine);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        const invalidKey =
          res.status === 400 &&
          /api key not valid|API_KEY_INVALID|invalid api key/i.test(apiMsg);
        const msg = invalidKey
          ? `${model}@${apiVersion}: ${getGoogleAiKeyInvalidHint(keySource)}`
          : `${model}@${apiVersion}: HTTP ${res.status} ${apiMsg}`.trim();
        if (isGeminiCapacityHttpError(res.status, apiMsg)) {
          noteGeminiCapacityFailure(msg);
        }
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = isGeminiCapacityHttpError(res.status, apiMsg)
          ? "Gemini capacity limit reached for this model."
          : msg;
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
      if (!candidate) {
        const msg = `${model}@${apiVersion}: no candidates`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      const grounding = candidate.groundingMetadata;
      const groundedSources = groundingToSourceList(grounding);
      const finishReason = candidate.finishReason;
      const parts = candidate.content?.parts ?? [];
      const answerParts = parts.filter(
        (p: { text?: string; thought?: boolean }) => p.text && !p.thought,
      );
      const text = (answerParts.length > 0 ? answerParts : parts)
        .map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join("\n");

      if (
        finishReason &&
        finishReason !== "STOP" &&
        finishReason !== "MAX_TOKENS" &&
        !(options.useGoogleSearch && groundedSources.length > 0)
      ) {
        const msg = `${model}@${apiVersion}: finishReason=${finishReason}`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      if (!text) {
        if (options.useGoogleSearch && groundedSources.length > 0) {
          return {
            text: "",
            grounding,
            totalTokens: data.usageMetadata?.totalTokenCount,
            model: `${model}+google_search`,
          };
        }
        const msg = `${model}@${apiVersion}: empty response`;
        lastGeminiAttemptLog.push(msg);
        lastGeminiError = msg;
        console.warn("[gemini-client]", msg);
        return null;
      }

      return {
        text,
        grounding,
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
  const fromChunks = (grounding?.groundingChunks ?? [])
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);
  if (fromChunks.length > 0) return fromChunks;

  return (grounding?.webSearchQueries ?? [])
    .filter(Boolean)
    .slice(0, 4)
    .map((query) => ({
      title: query,
      uri: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    }));
}
