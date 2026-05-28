import type { ModelClaimVerdict } from "@/types/news-platform";
import { env as cloudflareEnv } from "cloudflare:workers";
import { getServerEnv } from "../../env/server-env";

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

import { clampScore } from "../../reliability/utils/math";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const LLM_TIMEOUT_MS = Number(getServerEnv("LLM_FETCH_TIMEOUT_MS")) || 12_000;

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

export async function verifyClaimWithOpenAI(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = openaiKey();
  if (!apiKey) return null;

  const model =
    getServerEnv("OPENAI_VERIFICATION_MODEL") ??
    getServerEnv("OPENAI_TOPIC_MODEL") ??
    "gpt-4o-mini";
  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.role === "corroboration" ? 0.05 : 0.15,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      },
      LLM_TIMEOUT_MS,
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LlmVerdictPayload;
    if (!VALID_VERDICTS.has(parsed.verdict)) return null;

    return {
      provider: "openai",
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
