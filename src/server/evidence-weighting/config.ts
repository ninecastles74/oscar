import type { EvidenceDocumentType } from "@/types/news-platform";

/** Base weights (0–100) before dynamic adjustments. */
export const BASE_TYPE_WEIGHTS: Record<EvidenceDocumentType, number> = {
  court_document: 95,
  official_filing: 92,
  direct_video_audio: 88,
  firsthand_reporting: 85,
  verified_dataset: 90,
  standard_reporting: 62,
  anonymous_sourcing: 25,
  opinion_article: 30,
  secondary_summary: 40,
  syndicated_rewrite: 35,
  unsourced_social: 15,
};

export const HIGH_TRUST_TYPES: EvidenceDocumentType[] = [
  "court_document",
  "official_filing",
  "direct_video_audio",
  "firsthand_reporting",
  "verified_dataset",
];

export const LOW_TRUST_TYPES: EvidenceDocumentType[] = [
  "anonymous_sourcing",
  "opinion_article",
  "secondary_summary",
  "syndicated_rewrite",
  "unsourced_social",
];

export { EVIDENCE_TYPE_LABELS as TYPE_LABELS } from "@/lib/evidence-weight-labels";
