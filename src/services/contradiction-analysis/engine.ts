import { buildContradictionAnalysis, runContradictionAnalysisBatch } from "@/server/contradiction";
import type { ClassifiedClaim } from "@/server/analysis/verification/types";
import type { EvidenceItem } from "@/types/news-platform";
import type {
  ContradictionAnalysisBatchJson,
  ContradictionAnalysisInput,
  ContradictionAnalysisJson,
  ContradictionSeverityBreakdown,
} from "./types";

function severityBreakdown(
  report: ContradictionAnalysisJson,
): ContradictionSeverityBreakdown {
  const out: ContradictionSeverityBreakdown = {
    critical: 0,
    warning: 0,
    info: 0,
    other: 0,
  };
  for (const issue of report.issues) {
    const s = issue.severity?.toLowerCase() ?? "";
    if (s === "critical" || s === "fundamental" || s === "significant") out.critical += 1;
    else if (s === "warning" || s === "minor") out.warning += 1;
    else if (s === "info") out.info += 1;
    else out.other += 1;
  }
  return out;
}

function toJson(report: ReturnType<typeof buildContradictionAnalysis>): ContradictionAnalysisJson {
  const base = { ...report, issueCount: report.issues.length };
  return {
    ...base,
    severityBreakdown: severityBreakdown(base as ContradictionAnalysisJson),
  };
}

/**
 * Contradiction Analysis Engine (service facade)
 *
 * Detects claim vs evidence conflicts, cross-article differences, conflicting
 * reporting, omitted context, timeline inconsistencies, and unsupported causal claims.
 * Returns structured JSON only.
 */
export function analyzeContradictions(
  input: ContradictionAnalysisInput,
): ContradictionAnalysisJson {
  const report = buildContradictionAnalysis({
    claim: { id: input.claimId, text: input.claimText },
    evidence: input.evidence,
    peerArticles: input.peerArticles,
  });
  return toJson(report);
}

/** Analyze multiple claims in one pass. */
export function analyzeContradictionsBatch(input: {
  claims: { claimId: string; claimText: string }[];
  evidenceByClaimId: Record<string, EvidenceItem[]>;
  peerArticles?: ContradictionAnalysisInput["peerArticles"];
}): ContradictionAnalysisBatchJson {
  const classified: ClassifiedClaim[] = input.claims.map((c) => ({
    id: c.claimId,
    text: c.claimText,
    kind: "factual",
    verifiable: true,
  }));

  const batch = runContradictionAnalysisBatch(
    classified,
    input.evidenceByClaimId,
    input.peerArticles,
  );

  return {
    analyses: Object.values(batch.byClaimId).map(toJson),
    contradictions: batch.contradictions,
    missingContext: batch.missingContext,
  };
}

/** Build evidence rows from article coverage snippets. */
export function evidenceFromCoverage(
  rows: {
    id: string;
    sourceId: string;
    sourceName: string;
    excerpt: string;
    url: string;
    publishedAt?: string;
    supports?: boolean;
  }[],
): EvidenceItem[] {
  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    excerpt: row.excerpt,
    url: row.url,
    publishedAt: row.publishedAt ?? new Date().toISOString(),
    stance: row.supports === false ? "contradict" : "support",
    supports: row.supports !== false,
  }));
}
