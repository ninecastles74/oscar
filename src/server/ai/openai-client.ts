import { env as cloudflareEnv } from "cloudflare:workers";
import { getServerEnv } from "../env/server-env";
import { fetchWithTimeout } from "../utils/fetch-timeout";

function openaiKey(): string | undefined {
  const cf = cloudflareEnv as Record<string, unknown>;
  for (const name of ["OPENAI_API_KEY", "OPENAI_KEYS"] as const) {
    const v = cf[name];
    if (typeof v === "string" && v.trim()) return v.trim();
    const fromEnv = getServerEnv(name);
    if (fromEnv) return fromEnv;
  }
  return undefined;
}

let lastOpenAiError: string | undefined;

export function getLastOpenAiError(): string | undefined {
  return lastOpenAiError;
}

export function isOpenAiKeyConfigured(): boolean {
  return !!openaiKey();
}

export interface OpenAiChatOptions {
  model: string;
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonSchema?: Record<string, unknown>;
  jsonSchemaName?: string;
}

export async function openAiChatCompletion(
  options: OpenAiChatOptions,
): Promise<string | null> {
  const apiKey = openaiKey();
  if (!apiKey) {
    lastOpenAiError = "OPENAI_API_KEY is not configured";
    return null;
  }

  lastOpenAiError = undefined;
  const timeoutMs = options.timeoutMs ?? (Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 20_000);

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.system) messages.push({ role: "system", content: options.system });
  messages.push({ role: "user", content: options.user });

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 1024,
  };

  if (options.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.jsonSchemaName ?? "response",
        strict: true,
        schema: options.jsonSchema,
      },
    };
  }

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      lastOpenAiError = `HTTP ${res.status}${data.error?.message ? `: ${data.error.message}` : ""}`;
      console.warn("[openai]", lastOpenAiError);
      return null;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) {
      lastOpenAiError = "Empty response from OpenAI";
      return null;
    }

    return content;
  } catch (err) {
    lastOpenAiError = err instanceof Error ? err.message : "OpenAI request failed";
    console.warn("[openai]", lastOpenAiError);
    return null;
  }
}
