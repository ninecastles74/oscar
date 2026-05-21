import type { ReliabilityCategoryId, ReliabilityCategoryScore } from "@/types/news-platform";
import type { ScoringConfig } from "../config/scoring-config";
import type { ScoringSignals } from "../types/scoring.types";
import { computeConfidenceMetrics } from "./confidence";
import { computeContradictionMetrics } from "./contradictions";
import { clampScore } from "../utils/math";

const SENSATIONAL_RE =
  /\b(shocking|outrageous|devastating|miracle|slams|blasts|destroyed|horrific|bombshell|explosive)\b/i;

const CATEGORY_LABELS: Record<ReliabilityCategoryId, string> = {
  evidence_support: "Evidence Support",
  cross_source_corroboration: "Cross-Source Corroboration",
  context_completeness: "Context Completeness",
  contradiction_detection: "Contradiction Detection",
  sensationalism: "Sensationalism",
  source_transparency: "Source Transparency",
};

const CATEGORY_DESCRIPTIONS: Record<ReliabilityCategoryId, string> = {
  evidence_support:
    "Evidence-weighted strength of supporting passages cited for extracted claims.",
  cross_source_corroboration:
    "Corroboration confidence based on agreement across approved outlets.",
  context_completeness:
    "Reporting consistency of framing and whether key context appears in cited material.",
  contradiction_detection:
    "Inverse of contradiction frequency observed across approved sources.",
  sensationalism:
    "Inverse of emotionally loaded phrasing detected in claims and issue flags.",
  source_transparency:
    "Source transparency: attribution, citations, and declared content rights for the article body.",
};

export interface CategoryCalculationResult {
  categories: ReliabilityCategoryScore[];
  penalties: {
    contradictionPenalty: number;
    sensationalPenalty: number;
    missingContextPenalty: number;
    insufficientEvidencePenalty: number;
  };
  avgClaimConfidence: number;
  contradictionCount: number;
}

export function calculateCategoryScores(
  signals: ScoringSignals,
  config: ScoringConfig,
): CategoryCalculationResult {
  const confidence = computeConfidenceMetrics(signals.claims);
  const contradiction = computeContradictionMetrics(signals, config);
  const total = Math.max(1, signals.claims.length);

  const evidenceSupport = clampScore(
    confidence.avgClaimConfidence * config.confidenceInfluence +
      confidence.supportedRatio * 40 -
      confidence.insufficientRatio * 15,
  );

  const avgAgreement =
    signals.comparisons.length === 0
      ? 50
      : signals.comparisons.reduce((s, c) => s + c.agreementScore, 0) /
        signals.comparisons.length;
  const uniqueSources = new Set(
    signals.claims.flatMap((c) => c.evidence.map((e) => e.sourceId)),
  ).size;
  const corroboration = clampScore(avgAgreement * 0.7 + Math.min(30, uniqueSources * 4));

  const missingPenalty = Math.min(
    60,
    signals.missingContext.length * config.missingContextPenaltyPerFinding,
  );
  const contextCompleteness = clampScore(
    100 - missingPenalty - (signals.issueSummary.missingContext / total) * 20,
  );

  const sensationalHits = signals.claims.filter((c) => SENSATIONAL_RE.test(c.text)).length;
  const sensationalPenalty = Math.min(
    50,
    signals.issueSummary.emotionalLanguage * 10 +
      sensationalHits * config.sensationalPenaltyPerHit,
  );
  const sensationalism = clampScore(100 - sensationalPenalty);

  const insufficientEvidencePenalty = clampScore(confidence.insufficientRatio * 25);

  let transparency = 55;
  const { article } = signals;
  if (article.author) transparency += 12;
  if (article.contentRights === "user_provided") transparency += 8;
  if (signals.claims.some((c) => c.evidence.length > 0 && c.evidence.every((e) => e.url))) {
    transparency += 15;
  }
  if (article.contentRights === "metadata_only") transparency -= 5;
  const sourceTransparency = clampScore(transparency);

  const rawScores: Record<ReliabilityCategoryId, number> = {
    evidence_support: evidenceSupport,
    cross_source_corroboration: corroboration,
    context_completeness: contextCompleteness,
    contradiction_detection: contradiction.contradictionDetectionScore,
    sensationalism,
    source_transparency: sourceTransparency,
  };

  const categories = (Object.keys(config.categoryWeights) as ReliabilityCategoryId[]).map(
    (id) => ({
      id,
      label: CATEGORY_LABELS[id],
      score: rawScores[id],
      weight: config.categoryWeights[id],
      description: CATEGORY_DESCRIPTIONS[id],
    }),
  );

  return {
    categories,
    penalties: {
      contradictionPenalty: contradiction.contradictionPenalty,
      sensationalPenalty,
      missingContextPenalty: missingPenalty,
      insufficientEvidencePenalty,
    },
    avgClaimConfidence: confidence.avgClaimConfidence,
    contradictionCount: contradiction.incidentCount,
  };
}
