import type { ModelClaimVerdict, Verdict } from "@/types/news-platform";
import { env as cloudflareEnv } from "cloudflare:workers";
import { anthropicModelCandidates } from "../../ai/anthropic-models";
import { getServerEnv } from "../../env/server-env";
import { clampScore } from "../../reliability/utils/math";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

function anthropicKey(): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>).ANTHROPIC_API_KEY;
  if (typeof v === "string" && v.trim()) return v.trim();
  return getServerEnv("ANTHROPIC_API_KEY");
}

const LLM_TIMEOUT_MS = Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 20_000;
const MAX_429_RETRIES = Number(getServerEnv("ANTHROPIC_429_MAX_RETRIES")) || 3;

const VALID_VERDICTS = new Set<Verdict>([
  "supported",
  "disputed",
  "unclear",
  "insufficient_evidence",
]);

let lastAnthropicError: string | undefined;

export function getLastAnthropicError(): string | undefined {
  return lastAnthropicError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVerdict(raw: unknown): Verdict | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_VERDICTS.has(normalized as Verdict)) return normalized as Verdict;
  if (normalized.includes("insufficient")) return "insufficient_evidence";
  if (normalized.includes("disput")) return "disputed";
  if (normalized.includes("support")) return "supported";
  if (normalized.includes("unclear")) return "unclear";
  return null;
}

function extractJsonVerdict(raw: string, prefilledBrace = false): LlmVerdictPayload | null {
  const candidates = prefilledBrace
    ? [`{${raw}`, raw.startsWith("{") ? raw : `{${raw}`]
    : [raw.trim(), raw.match(/\{[\s\S]*"verdict"[\s\S]*\}/)?.[0] ?? ""];

  for (const text of candidates) {
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as Partial<LlmVerdictPayload>;
      const verdict = normalizeVerdict(parsed.verdict);
      if (!verdict) continue;
      return {
        verdict,
        confidence: Number(parsed.confidence) || 50,
        reasoning: String(parsed.reasoning ?? ""),
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 529 || status === 503;
}

function isModelErrorStatus(status: number): boolean {
  return status === 404 || status === 400;
}

export async function verifyClaimWithAnthropic(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = anthropicKey();
  if (!apiKey) {
    lastAnthropicError = "ANTHROPIC_API_KEY is not configured";
    return null;
  }

  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  lastAnthropicError = undefined;
  const models = anthropicModelCandidates();
  let lastAttemptError: string | undefined;

  for (const model of models) {
    for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
      try {
        const res = await fetchWithTimeout(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 1024,
              temperature: 0,
              system: `${system}\n\nRespond with one JSON object only. No markdown fences.`,
              messages: [
                { role: "user", content: user },
                { role: "assistant", content: "{" },
              ],
            }),
          },
          LLM_TIMEOUT_MS,
        );

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          lastAttemptError = `${model}: HTTP ${res.status}${errBody ? ` — ${errBody.slice(0, 240)}` : ""}`;
          if (isRetryableStatus(res.status) && attempt < MAX_429_RETRIES) {
            await sleep(1500 * (attempt + 1));
            continue;
          }
          if (isModelErrorStatus(res.status)) break;
          lastAnthropicError = lastAttemptError;
          return null;
        }

        const data = (await res.json()) as {
          content?: { type: string; text?: string }[];
          stop_reason?: string;
        };
        const raw = data.content?.find((c) => c.type === "text")?.text;
        if (!raw) {
          lastAttemptError = `${model}: empty response`;
          break;
        }

        const parsed = extractJsonVerdict(raw, true);
        if (!parsed) {
          lastAttemptError = `${model}: invalid verdict JSON (${raw.slice(0, 120)})`;
          break;
        }

        return {
          provider: "anthropic",
          model,
          role: input.role,
          verdict: parsed.verdict,
          confidence: clampScore(parsed.confidence),
          reasoning: parsed.reasoning.slice(0, 500),
        };
      } catch (err) {
        lastAttemptError = `${model}: ${err instanceof Error ? err.message : "request failed"}`;
        if (attempt < MAX_429_RETRIES) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  lastAnthropicError =
    lastAttemptError ??
    `All Anthropic models failed (${models.join(", ")}). Set ANTHROPIC_VERIFICATION_MODEL=claude-haiku-4-5-20251001`;
  console.warn("[anthropic] verification failed:", lastAnthropicError);
  return null;
}
