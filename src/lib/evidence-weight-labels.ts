import type { EvidenceDocumentType } from "@/types/news-platform";

export const EVIDENCE_TYPE_LABELS: Record<EvidenceDocumentType, string> = {
  court_document: "Court document",
  official_filing: "Official filing",
  direct_video_audio: "Direct video/audio",
  firsthand_reporting: "Firsthand reporting",
  verified_dataset: "Verified dataset",
  standard_reporting: "Standard reporting",
  anonymous_sourcing: "Anonymous sourcing",
  opinion_article: "Opinion article",
  secondary_summary: "Secondary summary",
  syndicated_rewrite: "Syndicated rewrite",
  unsourced_social: "Unsourced social claim",
};
