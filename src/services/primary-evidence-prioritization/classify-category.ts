import type { EvidenceDocumentType, EvidenceItem } from "@/types/news-platform";
import { classifyEvidenceType } from "@/server/evidence-weighting";
import type { EvidencePriorityCategory } from "./types";

const SPECULATIVE_RE =
  /\b(may|might|could|possibly|rumou?r|unconfirmed|speculat|alleged|reportedly|believed to|thought to)\b/i;

const UNVERIFIABLE_RE =
  /\b(no matching passage|not available|unable to verify|unverified|cannot confirm)\b/i;

const PRIMARY_DOC_TYPES = new Set<EvidenceDocumentType>([
  "court_document",
  "official_filing",
  "firsthand_reporting",
  "direct_video_audio",
  "verified_dataset",
]);

const TERTIARY_DOC_TYPES = new Set<EvidenceDocumentType>([
  "secondary_summary",
  "syndicated_rewrite",
]);

/** Map document type + excerpt signals to priority category. */
export function classifyEvidencePriorityCategory(
  item: EvidenceItem,
  claimText: string,
): EvidencePriorityCategory {
  const docType = item.evidenceType ?? classifyEvidenceType(item);
  const hay = `${item.excerpt} ${claimText}`.toLowerCase();

  if (UNVERIFIABLE_RE.test(item.excerpt) || docType === "unsourced_social") {
    return "unverifiable";
  }

  if (docType === "anonymous_sourcing" || /\banonymous\b/.test(hay)) {
    return "anonymous";
  }

  if (docType === "opinion_article" || /\b(op-?ed|editorial|commentary|in my view)\b/i.test(item.excerpt)) {
    return "opinion";
  }

  if (SPECULATIVE_RE.test(item.excerpt)) {
    return "speculative";
  }

  if (PRIMARY_DOC_TYPES.has(docType) || item.isDirectQuote) {
    return "primary";
  }

  if (TERTIARY_DOC_TYPES.has(docType)) {
    return "tertiary";
  }

  if (docType === "standard_reporting") {
    return "secondary";
  }

  return "secondary";
}

/** Base trust weight (0–100) per priority category. */
export const CATEGORY_TRUST_WEIGHT: Record<EvidencePriorityCategory, number> = {
  primary: 92,
  secondary: 62,
  tertiary: 38,
  opinion: 28,
  speculative: 18,
  anonymous: 22,
  unverifiable: 8,
};
