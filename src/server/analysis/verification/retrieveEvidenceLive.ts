import type { EvidenceItem } from "@/types/news-platform";
import { geminiGenerateContent, groundingToSourceList } from "../../ai/gemini-client";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import { getServerEnv } from "../../env/server-env";
import type { ClassifiedClaim } from "./types";

/** Max claims researched in one batched Gemini + Search call (saves free-tier quota). */
const MAX_CLAIMS = Number(getServerEnv("LIVE_EVIDENCE_MAX_CLAIMS")) || 5;

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

/**
 * Live web research — one batched Gemini + Google Search call for all claims (quota-friendly).
 */
export async function retrieveEvidenceLive(
  claims: ClassifiedClaim[],
): Promise<Record<string, EvidenceItem[]>> {
  if (!isGoogleAiConfigured()) return {};

  const batch = claims.slice(0, MAX_CLAIMS);
  if (batch.length === 0) return {};

  const claimLines = batch.map((c) => `- claimId="${c.id}": "${c.text}"`).join("\n");

  const result = await geminiGenerateContent({
    useGoogleSearch: true,
    system:
      "You are a news fact-check researcher. Use Google Search once to research all claims. Return JSON only.",
    user: `Research ALL of these claims using Google Search. Return JSON:
{"claims":[{"claimId":"...","evidence":[{"sourceName":"Outlet","url":"https://...","excerpt":"max 200 chars","stance":"support"|"contradict"|"neutral"}]}]}

Claims:
${claimLines}

Include 2-3 evidence items per claim from distinct sources when possible.`,
  });

  const out: Record<string, EvidenceItem[]> = {};

  if (result) {
    const parsed = parseBatchedEvidence(result.text);
    if (parsed?.length) {
      for (const row of parsed) {
        const items = evidenceFromParsed(row.claimId, row.evidence);
        if (items.length > 0) {
          out[row.claimId] = items;
          console.log(`[retrieveEvidenceLive] ${row.claimId}: ${items.length} live source(s)`);
        }
      }
    }

    const grounded = groundingToSourceList(result.grounding);
    for (const claim of batch) {
      if (out[claim.id]?.length) continue;
      if (grounded.length === 0) continue;
      const g = grounded[0]!;
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

  return out;
}
