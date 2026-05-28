import type { ModelClaimVerdict } from "@/types/news-platform";
import { env as cloudflareEnv } from "cloudflare:workers";
import { getServerEnv } from "../../env/server-env";

function anthropicKey(): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>).ANTHROPIC_API_KEY;
  if (typeof v === "string" && v.trim()) return v.trim();
  return getServerEnv("ANTHROPIC_API_KEY");
}

import { clampScore } from "../../reliability/utils/math";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const LLM_TIMEOUT_MS = Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 12_000;

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

export async function verifyClaimWithAnthropic(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = anthropicKey();
  if (!apiKey) return null;

  const model = getServerEnv("ANTHROPIC_VERIFICATION_MODEL") ?? "claude-3-5-haiku-20241022";
  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

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
          max_tokens: 512,
          temperature: 0.1,
          system: `${system}\n\nRespond with JSON only.`,
          messages: [{ role: "user", content: user }],
        }),
      },
      LLM_TIMEOUT_MS,
    );

    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const raw = data.content?.find((c) => c.type === "text")?.text;
    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as LlmVerdictPayload;
    if (!VALID_VERDICTS.has(parsed.verdict)) return null;

    return {
      provider: "anthropic",
      model,
      role: input.role,
      verdict: parsed.verdict,
      confidence: clampScore(Number(parsed.confidence) || 50),
      reasoning: String(parsed.reasoning ?? "").slice(0, 500),
    };
  } catch {
    return null;
  }
}
