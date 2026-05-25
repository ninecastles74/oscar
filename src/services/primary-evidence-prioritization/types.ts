import type { EvidenceDocumentType, EvidenceItem } from "@/types/news-platform";

/** Evidence priority tier for trust and ordering. */
export type EvidencePriorityCategory =
  | "primary"
  | "secondary"
  | "tertiary"
  | "opinion"
  | "speculative"
  | "anonymous"
  | "unverifiable";

export const EVIDENCE_PRIORITY_CATEGORIES: EvidencePriorityCategory[] = [
  "primary",
  "secondary",
  "tertiary",
  "opinion",
  "speculative",
  "anonymous",
  "unverifiable",
];

export interface PrimaryEvidencePrioritizationInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
}

export interface PrioritizedEvidenceItemJson {
  id: string;
  sourceId: string;
  sourceName?: string;
  category: EvidencePriorityCategory;
  trustWeight: number;
  evidenceType: EvidenceDocumentType;
  dynamicWeight: number;
  priorityRank: number;
  supports: boolean;
}

/**
 * Structured JSON from the Primary Evidence Prioritization System.
 */
export interface PrimaryEvidencePrioritizationJson {
  claimId: string;
  evidenceQualityScore: number;
  evidenceConfidenceScore: number;
  sourceTransparencyScore: number;
  prioritizedEvidence: PrioritizedEvidenceItemJson[];
  categoryDistribution: Record<EvidencePriorityCategory, number>;
}
