import type { EvidenceItem } from "@/types/news-platform";
import { geminiGenerateContent, groundingToSourceList } from "../../ai/gemini-client";
import {
  geminiEvidenceModelCandidates,
  resolveGeminiFallbackModel,
  resolveGeminiVerificationModel,
} from "../../ai/gemini-models";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import { openAiChatCompletion } from "../../ai/openai-client";
import { resolveOpenAiTopicModel } from "../../ai/openai-models";
import { isOpenAiConfigured, isServerEnvTruthy } from "../../env/server-env";
import { getServerEnv } from "../../env/server-env";
import { fetchWithTimeout } from "../../utils/fetch-timeout";
import { sanitizeApiSecretOrUndefined } from "../../ai/sanitize-api-secret";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { ClassifiedClaim } from "./types";

import { ANALYSIS_TIMEOUTS } from "../timeouts";

const MAX_TOTAL_CLAIMS = ANALYSIS_TIMEOUTS.maxClaims;
const BATCH_SIZE = Number(getServerEnv("LIVE_EVIDENCE_BATCH_SIZE")) || 2;
const MAX_CLAIM_RETRIES = ANALYSIS_TIMEOUTS.maxProviderRetries;
const CLAIM_TIMEOUT_MS = ANALYSIS_TIMEOUTS.evidenceClaimMs;
const BACKOFF_BASE_MS = Number(getServerEnv("LIVE_EVIDENCE_BACKOFF_MS")) || 1500;

export interface LiveEvidenceRetrievalResult {
  evidenceByClaimId: Record<string, EvidenceItem[]>;
  succeededClaimIds: string[];
  failedClaimIds: string[];
  fallbackModelUsed?: string;
  providerFallbackUsed?: "openai" | "anthropic";
}

interface BatchedEvidencePayload {
  claims?: Array<{
    claimId: string;
    evidence?: Array<{
      sourceName: string;
      url?: string;
      excerpt: string;
      stance?: "support" | "contradict" | "neutral";
    }>;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function claimLabel(claim: ClassifiedClaim, index: number): string {
  return `claim ${index + 1}`;
}

function parseBatchedEvidence(raw: string): BatchedEvidencePayload["claims"] | null {
  if (!raw.trim()) return null;
  try {
    const p = JSON.parse(raw) as BatchedEvidencePayload;
    return p.claims?.filter((c) => c.claimId && c.evidence?.length) ?? null;
  } catch {
    const m = raw.match(/\{[\s\S]*"claims"[\s\S]*\}/);
    if (!m) return null;
    try {
      const p = JSON.parse(m[0]) as BatchedEvidencePayload;
      return p.claims?.filter((c) => c.claimId && c.evidence?.length) ?? null;
    } catch {
      return null;
    }
  }
}

function resolveClaimId(returnedId: string, claims: ClassifiedClaim[]): string | undefined {
  const trimmed = returnedId.trim();
  if (claims.some((c) => c.id === trimmed)) return trimmed;
  const suffix = trimmed.match(/claim-\d+$/)?.[0];
  if (suffix) {
    const match = claims.find((c) => c.id.endsWith(suffix));
    if (match) return match.id;
  }
  const num = trimmed.match(/(\d+)/)?.[1];
  if (num) {
    const byNum = claims.find((c) => c.id.endsWith(`-claim-${num}`));
    if (byNum) return byNum.id;
  }
  return claims.find((c) => trimmed.includes(c.id) || c.id.includes(trimmed))?.id;
}

function makeItem(
  claimId: string,
  index: number,
  sourceName: string,
  excerpt: string,
  url: string,
  stance: EvidenceItem["stance"],
  suffix = "live-e",
): EvidenceItem {
  return {
    id: `${claimId}-${suffix}${index + 1}`,
    sourceId: sourceName.toLowerCase().replace(/\s+/g, "_").slice(0, 40),
    sourceName,
    excerpt: excerpt.slice(0, 400),
    stance,
    supports: stance === "support",
    url: url || "https://www.google.com/search",
    isDirectQuote: false,
    citationLabel: `[${sourceName}]`,
  };
}

function evidenceFromParsed(
  claimId: string,
  parsed: NonNullable<BatchedEvidencePayload["claims"]>[number]["evidence"],
  suffix = "live-e",
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  parsed?.slice(0, 4).forEach((e, i) => {
    const stance = e.stance === "contradict" || e.stance === "neutral" ? e.stance : "support";
    items.push(
      makeItem(claimId, i, e.sourceName || "Web source", e.excerpt, e.url ?? "", stance, suffix),
    );
  });
  return items;
}

function applyGroundingFallback(
  claims: ClassifiedClaim[],
  result: Awaited<ReturnType<typeof geminiGenerateContent>>,
  out: Record<string, EvidenceItem[]>,
): void {
  const grounded = groundingToSourceList(result?.grounding);
  if (grounded.length === 0) return;

  let sourceIndex = 0;
  for (const claim of claims) {
    if (out[claim.id]?.length) continue;
    const g = grounded[sourceIndex % grounded.length]!;
    sourceIndex += 1;
    out[claim.id] = [
      makeItem(
        claim.id,
        0,
        g.title ?? "Web source",
        "Source located via Google Search for this claim.",
        g.uri ?? "",
        "neutral",
      ),
    ];
  }
}

function applyGeminiResult(
  claims: ClassifiedClaim[],
  result: Awaited<ReturnType<typeof geminiGenerateContent>>,
  out: Record<string, EvidenceItem[]>,
): void {
  if (!result) return;

  const parsed = parseBatchedEvidence(result.text);
  if (parsed?.length) {
    for (const row of parsed) {
      const claimId = resolveClaimId(row.claimId, claims);
      if (!claimId) continue;
      const items = evidenceFromParsed(claimId, row.evidence);
      if (items.length > 0) out[claimId] = items;
    }
  }

  applyGroundingFallback(claims, result, out);
}

async function geminiResearchClaim(
  claim: ClassifiedClaim,
  model: string,
): Promise<Awaited<ReturnType<typeof geminiGenerateContent>>> {
  return geminiGenerateContent({
    model,
    useGoogleSearch: true,
    timeoutMs: CLAIM_TIMEOUT_MS,
    system: "You are a news fact-check researcher. Use Google Search. Return JSON only.",
    user: `Research this claim with Google Search. Return JSON:
{"claims":[{"claimId":"${claim.id}","evidence":[{"sourceName":"Outlet","url":"https://...","excerpt":"max 200 chars","stance":"support"|"contradict"|"neutral"}]}]}

Claim (${claim.id}): "${claim.text}"`,
  });
}

async function researchClaimWithGeminiRetries(
  claim: ClassifiedClaim,
  claimIndex: number,
  out: Record<string, EvidenceItem[]>,
): Promise<{ ok: boolean; fallbackModelUsed?: string }> {
  if (out[claim.id]?.length) return { ok: true };

  const models = geminiEvidenceModelCandidates();
  let fallbackModelUsed: string | undefined;

  for (let attempt = 0; attempt <= MAX_CLAIM_RETRIES; attempt++) {
    for (const model of models) {
      if (model !== models[0]) fallbackModelUsed = model;
      try {
        const result = await geminiResearchClaim(claim, model);
        applyGeminiResult([claim], result, out);
        if (out[claim.id]?.length) {
          console.log(
            `[retrieveEvidenceLive] ${claimLabel(claim, claimIndex)} succeeded via ${result?.model ?? model}`,
          );
          return { ok: true, fallbackModelUsed };
        }
      } catch (err) {
        console.warn(
          `[retrieveEvidenceLive] ${claimLabel(claim, claimIndex)} gemini error (${model}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (attempt < MAX_CLAIM_RETRIES) {
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;
      console.warn(
        `[retrieveEvidenceLive] ${claimLabel(claim, claimIndex)} retry ${attempt + 1}/${MAX_CLAIM_RETRIES} in ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }

  return { ok: false, fallbackModelUsed };
}

const EVIDENCE_JSON_PROMPT = `Return JSON only:
{"claims":[{"claimId":"<id>","evidence":[{"sourceName":"Outlet","url":"https://...","excerpt":"max 200 chars","stance":"support"|"contradict"|"neutral"}]}]}`;

async function researchClaimWithOpenAI(
  claim: ClassifiedClaim,
  claimIndex: number,
): Promise<EvidenceItem[]> {
  if (!isOpenAiConfigured()) return [];

  const raw = await openAiChatCompletion({
    model: resolveOpenAiTopicModel(),
    system:
      "You are a news fact-check researcher. Suggest real, citable sources and short excerpts relevant to the claim. Return JSON only.",
    user: `${EVIDENCE_JSON_PROMPT}\n\nclaimId="${claim.id}"\nClaim: "${claim.text}"`,
    timeoutMs: CLAIM_TIMEOUT_MS,
    maxTokens: 1024,
  });

  if (!raw) return [];

  const parsed = parseBatchedEvidence(raw);
  const row = parsed?.find((r) => resolveClaimId(r.claimId, [claim]) === claim.id) ?? parsed?.[0];
  if (!row?.evidence?.length) return [];

  const items = evidenceFromParsed(claim.id, row.evidence, "openai-e");
  if (items.length) {
    console.log(
      `[retrieveEvidenceLive] ${claimLabel(claim, claimIndex)} succeeded via OpenAI fallback`,
    );
  }
  return items;
}

function anthropicKey(): string | undefined {
  const v = (cloudflareEnv as Record<string, unknown>).ANTHROPIC_API_KEY;
  if (typeof v === "string" && v.trim()) {
    return sanitizeApiSecretOrUndefined(v);
  }
  return sanitizeApiSecretOrUndefined(getServerEnv("ANTHROPIC_API_KEY"));
}

async function researchClaimWithAnthropic(
  claim: ClassifiedClaim,
  claimIndex: number,
): Promise<EvidenceItem[]> {
  const apiKey = anthropicKey();
  if (!apiKey || !isServerEnvTruthy("ANTHROPIC_API_KEY")) return [];

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
          model: getServerEnv("ANTHROPIC_VERIFICATION_MODEL") ?? "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          temperature: 0,
          system:
            "You are a news fact-check researcher. Suggest real sources and excerpts. Return JSON only.",
          messages: [
            {
              role: "user",
              content: `${EVIDENCE_JSON_PROMPT}\n\nclaimId="${claim.id}"\nClaim: "${claim.text}"`,
            },
          ],
        }),
      },
      CLAIM_TIMEOUT_MS,
    );

    if (!res.ok) return [];

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = data.content?.find((c) => c.type === "text")?.text;
    if (!raw) return [];

    const parsed = parseBatchedEvidence(raw);
    const row = parsed?.find((r) => resolveClaimId(r.claimId, [claim]) === claim.id) ?? parsed?.[0];
    if (!row?.evidence?.length) return [];

    const items = evidenceFromParsed(claim.id, row.evidence, "claude-e");
    if (items.length) {
      console.log(
        `[retrieveEvidenceLive] ${claimLabel(claim, claimIndex)} succeeded via Anthropic fallback`,
      );
    }
    return items;
  } catch {
    return [];
  }
}

async function researchClaimBatch(
  batch: ClassifiedClaim[],
  out: Record<string, EvidenceItem[]>,
): Promise<void> {
  if (batch.length === 0) return;

  const claimLines = batch
    .map((c, i) => `${i + 1}. claimId="${c.id}" (use exactly): "${c.text}"`)
    .join("\n");

  const result = await geminiGenerateContent({
    model: resolveGeminiVerificationModel(),
    useGoogleSearch: true,
    timeoutMs: CLAIM_TIMEOUT_MS,
    system:
      "You are a news fact-check researcher. Use Google Search to find real sources. Return JSON only with exact claimId values from the input.",
    user: `Research EACH claim below using Google Search. Return one entry per claim in JSON:
{"claims":[{"claimId":"<exact id>","evidence":[{"sourceName":"Outlet","url":"https://...","excerpt":"max 200 chars","stance":"support"|"contradict"|"neutral"}]}]}

Claims (every claimId below MUST appear in your JSON):
${claimLines}

Include 1-2 evidence items per claim.`,
  });

  applyGeminiResult(batch, result, out);
}

/**
 * Live web research with per-claim retries, Gemini fallback model, and OpenAI/Claude fallback.
 * Partial failures do not throw — caller receives succeeded/failed claim lists.
 */
export async function retrieveEvidenceLive(
  claims: ClassifiedClaim[],
): Promise<LiveEvidenceRetrievalResult> {
  const empty: LiveEvidenceRetrievalResult = {
    evidenceByClaimId: {},
    succeededClaimIds: [],
    failedClaimIds: [],
  };

  if (!isGoogleAiConfigured()) return empty;

  const toResearch = claims.slice(0, MAX_TOTAL_CLAIMS);
  if (toResearch.length === 0) return empty;

  const out: Record<string, EvidenceItem[]> = {};
  let fallbackModelUsed: string | undefined;
  let providerFallbackUsed: "openai" | "anthropic" | undefined;

  for (let i = 0; i < toResearch.length; i += BATCH_SIZE) {
    const chunk = toResearch.slice(i, i + BATCH_SIZE);
    await researchClaimBatch(chunk, out);
  }

  for (let i = 0; i < toResearch.length; i++) {
    const claim = toResearch[i]!;
    if (out[claim.id]?.length) continue;

    const gem = await researchClaimWithGeminiRetries(claim, i, out);
    if (gem.fallbackModelUsed) fallbackModelUsed = gem.fallbackModelUsed;
    if (out[claim.id]?.length) continue;

    const openAiItems = await researchClaimWithOpenAI(claim, i);
    if (openAiItems.length) {
      out[claim.id] = openAiItems;
      providerFallbackUsed = "openai";
      continue;
    }

    const claudeItems = await researchClaimWithAnthropic(claim, i);
    if (claudeItems.length) {
      out[claim.id] = claudeItems;
      providerFallbackUsed = "anthropic";
    }
  }

  const succeededClaimIds = toResearch.filter((c) => (out[c.id]?.length ?? 0) > 0).map((c) => c.id);
  const failedClaimIds = toResearch.filter((c) => !out[c.id]?.length).map((c) => c.id);

  console.log(
    "[retrieveEvidenceLive] summary:",
    JSON.stringify({
      total: toResearch.length,
      succeeded: succeededClaimIds.length,
      failed: failedClaimIds.length,
      fallbackModel: fallbackModelUsed ?? resolveGeminiFallbackModel(),
      providerFallback: providerFallbackUsed ?? null,
    }),
  );

  if (succeededClaimIds.length) {
    console.log(
      "[retrieveEvidenceLive] succeeded:",
      succeededClaimIds
        .map((id) => {
          const idx = toResearch.findIndex((c) => c.id === id);
          return claimLabel(toResearch[idx]!, idx);
        })
        .join(", "),
    );
  }
  if (failedClaimIds.length) {
    console.log(
      "[retrieveEvidenceLive] failed:",
      failedClaimIds
        .map((id) => {
          const idx = toResearch.findIndex((c) => c.id === id);
          return claimLabel(toResearch[idx]!, idx);
        })
        .join(", "),
    );
  }

  return {
    evidenceByClaimId: out,
    succeededClaimIds,
    failedClaimIds,
    fallbackModelUsed,
    providerFallbackUsed,
  };
}
