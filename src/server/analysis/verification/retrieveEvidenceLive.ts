import type { EvidenceItem } from "@/types/news-platform";
import { geminiGenerateContent, groundingToSourceList } from "../../ai/gemini-client";
import { isGoogleAiConfigured } from "../../ai/google-api-key";
import type { ClassifiedClaim } from "./types";

const MAX_CLAIMS = Number(process.env.LIVE_EVIDENCE_MAX_CLAIMS) || 4;

interface EvidencePayload {
  evidence?: Array<{
    sourceName: string;
    url?: string;
    excerpt: string;
    stance?: "support" | "contradict" | "neutral";
  }>;
}

function parseEvidenceJson(raw: string): EvidencePayload["evidence"] | null {
  try {
    const p = JSON.parse(raw) as EvidencePayload;
    return p.evidence?.filter((e) => e.excerpt?.trim()) ?? null;
  } catch {
    const m = raw.match(/\{[\s\S]*"evidence"[\s\S]*\}/);
    if (!m) return null;
    try {
      const p = JSON.parse(m[0]) as EvidencePayload;
      return p.evidence?.filter((e) => e.excerpt?.trim()) ?? null;
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

/**
 * Live web research per claim using Gemini + Google Search (real API usage).
 */
export async function retrieveEvidenceLive(
  claims: ClassifiedClaim[],
): Promise<Record<string, EvidenceItem[]>> {
  if (!isGoogleAiConfigured()) return {};

  const out: Record<string, EvidenceItem[]> = {};
  const batch = claims.slice(0, MAX_CLAIMS);

  for (const claim of batch) {
    const result = await geminiGenerateContent({
      useGoogleSearch: true,
      system:
        "You are a news fact-check researcher. Use Google Search to find real, current sources. Return JSON only.",
      user: `Claim to research: "${claim.text}"

Use Google Search. Return JSON:
{"evidence":[{"sourceName":"Outlet name","url":"https://...","excerpt":"Relevant quote or summary (max 200 chars)","stance":"support"|"contradict"|"neutral"}]}

Include 2-4 items from distinct sources when possible.`,
    });

    if (!result) continue;

    const parsed = parseEvidenceJson(result.text);
    const items: EvidenceItem[] = [];

    if (parsed?.length) {
      parsed.slice(0, 4).forEach((e, i) => {
        const stance = e.stance === "contradict" || e.stance === "neutral" ? e.stance : "support";
        items.push(
          makeItem(
            claim.id,
            i,
            e.sourceName || "Web source",
            e.excerpt,
            e.url ?? "",
            stance,
          ),
        );
      });
    }

    const grounded = groundingToSourceList(result.grounding);
    for (let i = 0; i < grounded.length && items.length < 5; i++) {
      const g = grounded[i]!;
      if (items.some((x) => x.url === g.uri)) continue;
      items.push(
        makeItem(
          claim.id,
          items.length,
          g.title ?? "Web source",
          `Source located via Google Search for this claim.`,
          g.uri ?? "",
          "neutral",
        ),
      );
    }

    if (items.length > 0) {
      out[claim.id] = items;
      console.log(`[retrieveEvidenceLive] ${claim.id}: ${items.length} live source(s)`);
    }
  }

  return out;
}
