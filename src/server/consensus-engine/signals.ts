import type {
  Claim,
  ConsensusSignalContribution,
  ConsensusSignalDimension,
  ReliabilityScoreBundle,
} from "@/types/news-platform";
import { SIGNAL_LABELS, SIGNAL_WEIGHTS } from "./config";
import { clampScore } from "../reliability/utils/math";

export interface ExtractedSignals {
  contributions: ConsensusSignalContribution[];
  compositeScore: number;
}

function catScore(
  bundle: ReliabilityScoreBundle | undefined,
  id: import("@/types/news-platform").ReliabilityCategoryId,
): number | undefined {
  return bundle?.article.categories.find((c) => c.id === id)?.score;
}

/**
 * Gather six consensus inputs from claim enrichment + historical reliability.
 */
export function extractConsensusSignals(
  claim: Claim,
  reliability?: ReliabilityScoreBundle | null,
): ExtractedSignals {
  const research = claim.claimResearch;
  const mm = claim.multiModelVerification;
  const contra = claim.contradictionAnalysis;

  const evidenceQuality = clampScore(
    research?.evidenceQuality?.aggregateScore ??
      research?.scores?.evidenceQualityScore ??
      averageEvidenceWeight(claim),
  );

  const aiReasoning = clampScore(
    mm?.consensus.finalConfidence ??
      (claim.confidence > 0 ? claim.confidence : 50),
  );

  const sourceIndependence = clampScore(
    research?.scores?.sourceIndependenceScore ??
      (research?.independentConfirmationCount
        ? Math.min(100, research.independentConfirmationCount * 25)
        : 40),
  );

  const contradictionRisk =
    research?.scores?.contradictionScore ?? contra?.contradictionScore ?? 0;
  const contradictionAnalysis = clampScore(100 - contradictionRisk);

  const corroboration = clampScore(
    research?.scores?.corroborationScore ??
      (research?.independentConfirmationCount && research.independentConfirmationCount > 0
        ? 55 + research.independentConfirmationCount * 10
        : 30),
  );

  const historicalReliability = clampScore(
    reliability
      ? averageDefined([
          reliability.organization?.overallScore,
          reliability.organization?.corroborationConfidence,
          catScore(reliability, "cross_source_corroboration"),
          catScore(reliability, "contradiction_detection"),
          reliability.article.overallScore,
        ])
      : sourceIndependence,
  );

  const raw: { dimension: ConsensusSignalDimension; score: number; narrative: string }[] = [
    {
      dimension: "evidence_quality",
      score: evidenceQuality,
      narrative: research?.evidenceQuality?.summary ?? `Evidence quality signal ${evidenceQuality}/100.`,
    },
    {
      dimension: "ai_reasoning",
      score: aiReasoning,
      narrative: mm
        ? `Multi-model consensus (${mm.consensus.arbitrationMethod}): ${mm.consensus.consensusSummary}`
        : `Pipeline confidence signal ${aiReasoning}/100.`,
    },
    {
      dimension: "source_independence",
      score: sourceIndependence,
      narrative: research
        ? `${research.independentConfirmationCount} independent source(s); ${research.repeatedReportingCount} repeated pattern(s).`
        : "Source independence inferred from available citations.",
    },
    {
      dimension: "contradiction_analysis",
      score: contradictionAnalysis,
      narrative: contra
        ? `Contradiction risk ${contra.contradictionScore}/100; ${contra.issues.length} issue(s) flagged.`
        : `Low contradiction risk (${contradictionRisk}/100).`,
    },
    {
      dimension: "corroboration",
      score: corroboration,
      narrative: research?.unsupported.isUnsupported
        ? `Unsupported: ${research.unsupported.reason}`
        : `Corroboration strength ${corroboration}/100.`,
    },
    {
      dimension: "historical_reliability",
      score: historicalReliability,
      narrative: reliability
        ? `Outlet historical reliability ${reliability.organization?.overallScore ?? "n/a"}/100; topic/article scores blended.`
        : "Historical reliability unavailable — used independence proxy.",
    },
  ];

  const contributions: ConsensusSignalContribution[] = raw.map((r) => {
    const weight = SIGNAL_WEIGHTS[r.dimension];
    const weightedContribution = Math.round(r.score * weight * 10) / 10;
    return {
      dimension: r.dimension,
      label: SIGNAL_LABELS[r.dimension],
      score: r.score,
      weight,
      weightedContribution,
      narrative: r.narrative,
    };
  });

  const compositeScore = clampScore(
    contributions.reduce((s, c) => s + c.score * c.weight, 0),
  );

  return { contributions, compositeScore };
}

function averageEvidenceWeight(claim: Claim): number {
  const weights = claim.evidence
    .filter((e) => e.stance === "support" || e.supports)
    .map((e) => e.dynamicWeight ?? 50);
  if (weights.length === 0) return 15;
  return weights.reduce((a, b) => a + b, 0) / weights.length;
}

function averageDefined(values: (number | undefined)[]): number {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return 50;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
