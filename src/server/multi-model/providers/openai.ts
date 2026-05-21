import type { ModelClaimVerdict } from "@/types/news-platform";
import { clampScore } from "../../reliability/utils/math";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

export async function verifyClaimWithOpenAI(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_VERIFICATION_MODEL ?? process.env.OPENAI_TOPIC_MODEL ?? "gpt-4o-mini";
  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
    });

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
