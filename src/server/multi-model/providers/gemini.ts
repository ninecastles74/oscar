import type { ModelClaimVerdict } from "@/types/news-platform";
import { clampScore } from "../../reliability/utils/math";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const VALID_VERDICTS = new Set(["supported", "disputed", "unclear", "insufficient_evidence"]);

export async function verifyClaimWithGemini(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.GEMINI_VERIFICATION_MODEL ?? "gemini-2.0-flash";
  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.05,
          responseMimeType: "application/json",
        },
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as LlmVerdictPayload;
    if (!VALID_VERDICTS.has(parsed.verdict)) return null;

    return {
      provider: "google",
      model,
      role: "corroboration",
      verdict: parsed.verdict,
      confidence: clampScore(Number(parsed.confidence) || 50),
      reasoning: String(parsed.reasoning ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
}
