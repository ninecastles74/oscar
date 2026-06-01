import type { ModelClaimVerdict, Verdict } from "@/types/news-platform";
import { getLastGeminiError } from "../../ai/gemini-client";
import { isGeminiGoogleSearchEnabled } from "../../ai/google-api-key";
import { geminiGenerateContent } from "../../ai/gemini-client";
import { clampScore } from "../../reliability/utils/math";
import { getServerEnv } from "../../env/server-env";
import { buildVerificationPrompt, formatEvidenceSummary } from "./prompt";
import type { LlmVerdictPayload, VerifyClaimApiInput } from "./types";

const LLM_TIMEOUT_MS = Number(getServerEnv("GEMINI_FETCH_TIMEOUT_MS")) || 25_000;

const VALID_VERDICTS = new Set<Verdict>([
  "supported",
  "disputed",
  "unclear",
  "insufficient_evidence",
]);

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

function extractJsonVerdict(raw: string): LlmVerdictPayload | null {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.match(/\{[\s\S]*"verdict"[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const text of candidates) {
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
      // try next
    }
  }
  return null;
}

function buildGeminiMeta(
  result: Awaited<ReturnType<typeof geminiGenerateContent>>,
  searchEnabled: boolean,
): ModelClaimVerdict["geminiMeta"] {
  const grounding = result?.grounding;
  const queries = grounding?.webSearchQueries ?? [];
  const chunks = grounding?.groundingChunks ?? [];
  const sourcesUsed = chunks
    .map((c) => c.web)
    .filter((w): w is { title?: string; uri?: string } => !!w?.uri || !!w?.title)
    .slice(0, 8);

  return {
    liveApiCalled: true,
    searchPerformed: searchEnabled && queries.length > 0,
    searchQueryCount: queries.length,
    webSearchQueries: queries.slice(0, 6),
    sourcesUsed,
    totalTokens: result?.totalTokens,
  };
}

/** Gemini verification/corroboration with optional Google Search grounding. */
export async function verifyClaimWithGemini(
  input: VerifyClaimApiInput,
): Promise<ModelClaimVerdict | null> {
  const useGoogleSearch =
    input.role === "corroboration" &&
    isGeminiGoogleSearchEnabled() &&
    !input.skipGoogleSearch;

  const { system, user } = buildVerificationPrompt({
    ...input,
    evidenceSummary: formatEvidenceSummary(input.evidence),
  });

  const jsonSuffix =
    '\n\nRespond with ONLY one JSON object: {"verdict":"supported|disputed|unclear|insufficient_evidence","confidence":0-100,"reasoning":"..."}';

  const result = await geminiGenerateContent({
    system,
    user: useGoogleSearch
      ? `${user}\n\nUse Google Search when needed.${jsonSuffix}`
      : `${user}${jsonSuffix}`,
    useGoogleSearch,
    jsonMode: !useGoogleSearch,
    timeoutMs: LLM_TIMEOUT_MS,
  });

  if (!result) return null;

  const parsed = extractJsonVerdict(result.text);
  if (!parsed) {
    console.warn("[gemini] invalid verdict JSON:", result.text.slice(0, 120));
    return null;
  }

  return {
    provider: "google",
    model: result.model,
    role: input.role,
    verdict: parsed.verdict,
    confidence: clampScore(parsed.confidence),
    reasoning: parsed.reasoning.slice(0, 500),
    geminiMeta: buildGeminiMeta(result, useGoogleSearch),
  };
}

export function getGeminiVerificationError(): string | undefined {
  return getLastGeminiError();
}
