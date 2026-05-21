import type { ReliabilityCategoryId } from "@/types/news-platform";

export const CATEGORY_WEIGHTS: Record<ReliabilityCategoryId, number> = {
  evidence_support: 0.25,
  cross_source_corroboration: 0.2,
  context_completeness: 0.15,
  contradiction_detection: 0.15,
  sensationalism: 0.1,
  source_transparency: 0.15,
};

export const CATEGORY_LABELS: Record<ReliabilityCategoryId, string> = {
  evidence_support: "Evidence Support",
  cross_source_corroboration: "Cross-Source Corroboration",
  context_completeness: "Context Completeness",
  contradiction_detection: "Contradiction Detection",
  sensationalism: "Sensationalism",
  source_transparency: "Source Transparency",
};

export const CATEGORY_DESCRIPTIONS: Record<ReliabilityCategoryId, string> = {
  evidence_support: "Evidence-weighted strength of supporting passages cited for extracted claims.",
  cross_source_corroboration:
    "Corroboration confidence based on agreement across approved outlets.",
  context_completeness:
    "Reporting consistency of framing and whether key context appears in cited material.",
  contradiction_detection: "Inverse of contradiction frequency observed across approved sources.",
  sensationalism: "Inverse of emotionally loaded phrasing detected in claims and issue flags.",
  source_transparency:
    "Source transparency: attribution, citations, and declared content rights for the article body.",
};

export const ROLLING_WINDOW = 20;
export const TREND_COMPARE_WINDOW = 5;
