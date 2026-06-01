import type { EvidenceItem } from "@/types/news-platform";
import { geminiGenerateContent, groundingToSourceList } from "../../ai/gemini-client";
import { resolveGeminiVerificationModel } from "../../ai/gemini-models";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import { getServerEnv } from "../../env/server-env";
import type { ClassifiedClaim } from "./types";

/** Max claims to research per analysis (aligned with multi-model cap). */
const MAX_TOTAL_CLAIMS = Number(getServerEnv("LIVE_EVIDENCE_MAX_CLAIMS")) || 5;
/** Claims per batched Google Search call (smaller JSON = more claims covered). */
const BATCH_SIZE = Number(getServerEnv("LIVE_EVIDENCE_BATCH_SIZE")) || 2;
const EVIDENCE_MODEL = resolveGeminiVerificationModel();

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
): EvidenceItem {
  return {
    id: `${claimId}-live-e${index + 1}`,
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
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  parsed?.slice(0, 4).forEach((e, i) => {
    const stance = e.stance === "contradict" || e.stance === "neutral" ? e.stance : "support";
    items.push(
      makeItem(claimId, i, e.sourceName || "Web source", e.excerpt, e.url ?? "", stance),
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
    console.log(`[retrieveEvidenceLive] ${claim.id}: grounding fallback source`);
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
      if (items.length > 0) {
        out[claimId] = items;
        console.log(`[retrieveEvidenceLive] ${claimId}: ${items.length} live source(s)`);
      }
    }
  }

  applyGroundingFallback(claims, result, out);
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
    model: EVIDENCE_MODEL,
    useGoogleSearch: true,
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

async function researchSingleClaim(
  claim: ClassifiedClaim,
  out: Record<string, EvidenceItem[]>,
): Promise<void> {
  if (out[claim.id]?.length) return;

  const result = await geminiGenerateContent({
    model: EVIDENCE_MODEL,
    useGoogleSearch: true,
    system: "You are a news fact-check researcher. Use Google Search. Return JSON only.",
    user: `Research this claim with Google Search. Return JSON:
{"claims":[{"claimId":"${claim.id}","evidence":[{"sourceName":"Outlet","url":"https://...","excerpt":"max 200 chars","stance":"support"|"contradict"|"neutral"}]}]}

Claim (${claim.id}): "${claim.text}"`,
  });
  applyGeminiResult([claim], result, out);
}

/**
 * Live web research — batched Gemini + Google Search for every claim (with per-claim retry).
 */
export async function retrieveEvidenceLive(
  claims: ClassifiedClaim[],
): Promise<Record<string, EvidenceItem[]>> {
  if (!isGoogleAiConfigured()) return {};

  const toResearch = claims.slice(0, MAX_TOTAL_CLAIMS);
  if (toResearch.length === 0) return {};

  const out: Record<string, EvidenceItem[]> = {};

  for (let i = 0; i < toResearch.length; i += BATCH_SIZE) {
    const chunk = toResearch.slice(i, i + BATCH_SIZE);
    await researchClaimBatch(chunk, out);
  }

  const missing = toResearch.filter((c) => !out[c.id]?.length);
  for (const claim of missing) {
    await researchSingleClaim(claim, out);
  }

  return out;
}
