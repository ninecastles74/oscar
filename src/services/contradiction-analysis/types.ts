import type { ContradictionAnalysisReport, EvidenceItem } from "@/types/news-platform";
import type { PeerArticleSlice } from "@/server/contradiction/types";

export interface ContradictionAnalysisInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
  peerArticles?: PeerArticleSlice[];
}

/** Severity counts for structured JSON consumers. */
export interface ContradictionSeverityBreakdown {
  critical: number;
  warning: number;
  info: number;
  other: number;
}

/**
 * Structured JSON from the Contradiction Analysis service.
 * Extends the full engine report with aggregate counters.
 */
export interface ContradictionAnalysisJson extends ContradictionAnalysisReport {
  issueCount: number;
  severityBreakdown: ContradictionSeverityBreakdown;
}

export interface ContradictionAnalysisBatchJson {
  analyses: ContradictionAnalysisJson[];
  contradictions: import("@/server/analysis/verification/types").ContradictionFinding[];
  missingContext: import("@/server/analysis/verification/types").MissingContextFinding[];
}

/** Structured JSON from the Contradiction & Omission Analysis Engine. */
export interface ContradictionOmissionAnalysisJson {
  claimId: string;
  contradictionScore: number;
  omissionScore: number;
  contextCompletenessScore: number;
  framingIntensityScore: number;
}
