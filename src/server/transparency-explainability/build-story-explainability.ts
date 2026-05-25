import type {
  ExplainabilityEvidenceItem,
  ScoreCalculationStep,
  ScoreExplainability,
  StoryConsensusReport,
} from "@/types/news-platform";
import { RELIABILITY_SCORING_DISCLAIMER } from "@/types/news-platform";
import type { StoryConsensusIntelligenceReport } from "../consensus/story-intelligence/types";
import { queryHistoricalSnapshots } from "../reliability/historical/snapshot-store";

function buildEvidenceFromReport(report: StoryConsensusReport): {
  supporting: ExplainabilityEvidenceItem[];
  disputed: ExplainabilityEvidenceItem[];
} {
  const supporting: ExplainabilityEvidenceItem[] = [];
  const disputed: ExplainabilityEvidenceItem[] = [];
  let idx = 0;

  for (const cell of report.sourceAgreementMap.cells) {
    if (!cell.excerpt) continue;
    const src = report.sourceAgreementMap.sources.find((s) => s.articleId === cell.articleId);
    const item: ExplainabilityEvidenceItem = {
      id: `story_ev_${idx++}`,
      claimId: cell.groupId,
      claimText:
        report.sourceAgreementMap.claimGroups.find((g) => g.groupId === cell.groupId)
          ?.canonicalText ?? "",
      sourceId: cell.sourceId,
      sourceName: src?.sourceName ?? cell.sourceId,
      stance: cell.stance === "dispute" ? "contradict" : "support",
      excerpt: cell.excerpt,
      url: src?.url,
    };
    if (cell.stance === "support") supporting.push(item);
    else if (cell.stance === "dispute") disputed.push(item);
  }

  for (const d of report.disputedClaims) {
    disputed.push({
      id: `story_dispute_${d.groupId}`,
      claimId: d.groupId,
      claimText: d.canonicalText,
      sourceId: d.sourceIds[0] ?? "cluster",
      sourceName: d.sourceIds.join(", "),
      stance: "contradict",
      excerpt: d.description,
    });
  }

  return { supporting, disputed };
}

function buildCalculationSteps(
  report: StoryConsensusReport,
  evidenceDensityScore?: number,
): ScoreCalculationStep[] {
  const steps: ScoreCalculationStep[] = [
    {
      categoryId: "cross_source_corroboration",
      label: "Cross-source consensus",
      score: report.consensusScore,
      weight: 0.5,
      weightPercent: 50,
      contribution: Math.round(report.consensusScore * 0.5),
      description: "Agreement across outlets on aligned claims.",
      formulaSummary: `${report.consensusScore}% consensus`,
    },
    {
      categoryId: "contradiction_detection",
      label: "Dispute exposure",
      score: Math.max(0, 100 - report.disputeScore),
      weight: 0.3,
      weightPercent: 30,
      contribution: Math.round((100 - report.disputeScore) * 0.3),
      description: "Inverse of disputed-claim share in the cluster.",
      formulaSummary: `${report.disputeScore}% dispute score`,
    },
    {
      categoryId: "context_completeness",
      label: "Clarity",
      score: Math.max(0, 100 - report.uncertaintyScore),
      weight: 0.2,
      weightPercent: 20,
      contribution: Math.round((100 - report.uncertaintyScore) * 0.2),
      description: "Inverse of uncertainty from unclear claims and missing context.",
      formulaSummary: `${report.uncertaintyScore}% uncertainty`,
    },
  ];

  if (evidenceDensityScore != null) {
    steps.push({
      categoryId: "evidence_support",
      label: "Evidence density",
      score: evidenceDensityScore,
      weight: 0,
      weightPercent: 0,
      contribution: 0,
      description: "How densely claims are backed by citations across the cluster.",
      formulaSummary: `${evidenceDensityScore}% evidence density`,
    });
  }

  return steps;
}

/**
 * Build story-level score explainability from a cluster consensus report.
 */
export function buildStoryScoreExplainability(
  report: StoryConsensusReport,
  intelligence?: StoryConsensusIntelligenceReport,
): ScoreExplainability {
  const { supporting, disputed } = buildEvidenceFromReport(report);
  const evidenceDensity = intelligence?.evidenceDensityScore;

  const corroboratingSources = report.sourceAgreementMap.sources.map((s) => ({
    sourceId: s.sourceId,
    sourceName: s.sourceName,
    domain: s.sourceDomain,
    supportingClaims: report.overlappingClaims.filter((c) => c.sourceIds.includes(s.sourceId))
      .length,
    excerpts: report.sourceAgreementMap.cells
      .filter((c) => c.articleId === s.articleId && c.excerpt)
      .map((c) => c.excerpt!.slice(0, 200)),
    agreementScore: report.consensusScore,
  }));

  const contradictionHistory = [
    ...report.disputedClaims.map((d) => ({
      claimId: d.groupId,
      claimText: d.canonicalText,
      description: d.description,
      severity: d.severity,
      sourceIds: d.sourceIds,
      sourceNames: d.sourceIds,
      recordedAt: report.computedAt,
    })),
    ...(intelligence?.emergingContradictions.map((c) => ({
      claimId: c.groupId,
      claimText: c.canonicalText,
      description: c.description,
      severity: c.severity,
      sourceIds: c.sourceIds,
      sourceNames: c.sourceIds,
      recordedAt: report.computedAt,
    })) ?? []),
  ];

  const omittedContext = [
    ...report.omittedContext.map((o) => ({
      claimId: o.groupId ?? o.claimText.slice(0, 24),
      claimText: o.claimText,
      description: o.description,
      severity: o.severity,
    })),
    ...(intelligence?.missingEvidence.map((m) => ({
      claimId: m.claimText.slice(0, 24),
      claimText: m.claimText,
      description: m.description,
      severity: m.severity,
    })) ?? []),
  ];

  const snapshots = queryHistoricalSnapshots({
    entityType: "topic",
    metricType: "overall_score",
    limit: 8,
  });
  const historicalChanges = snapshots.map((s, i, arr) => ({
    version: i + 1,
    recordedAt: s.recordedAt,
    overallScore: s.scoreValue,
    delta: i > 0 ? s.scoreValue - arr[i - 1].scoreValue : null,
    summary: `Topic-level reliability snapshot (${s.metricType})`,
  }));

  const narrativeNote =
    intelligence?.evolvingNarratives.length || report.narrativeDifferences.length
      ? ` Narrative drift: ${(intelligence?.evolvingNarratives ?? report.narrativeDifferences)
          .map((n) => n.aspect)
          .join(", ")}.`
      : "";

  return {
    entityType: "story",
    entityId: report.clusterId,
    entityLabel: report.title,
    overallScore: report.storyConfidence,
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    whyScoreExists:
      `This story confidence score (${report.storyConfidence}/100) summarizes how ${report.sourceCount} outlet(s) ` +
      `cover the same event: ${report.overlappingClaims.length} overlapping claim(s), ` +
      `${report.disputedClaims.length} disputed, ${report.omittedContext.length} context gap(s). ` +
      `It reflects cross-source alignment, not whether the underlying event is true.`,
    howCalculated:
      "Story confidence blends cross-source consensus (50%), inverse dispute exposure (30%), and inverse uncertainty (20%). " +
      "Evidence density and framing differences inform the narrative sections below.",
    weightedFormula: `consensus ${report.consensusScore} × 0.5 + (100 − dispute ${report.disputeScore}) × 0.3 + (100 − uncertainty ${report.uncertaintyScore}) × 0.2`,
    calculationSteps: buildCalculationSteps(report, evidenceDensity),
    supportingEvidence: supporting,
    disputedEvidence: disputed,
    corroboratingSources,
    contradictionHistory,
    omittedContext,
    aiReasoningSummary:
      (report.findingsSummary?.trim() ||
        report.summary) + narrativeNote,
    confidenceExplanation:
      `Story confidence ${report.storyConfidence}/100. Consensus ${report.consensusScore}%, dispute ${report.disputeScore}%, ` +
      `uncertainty ${report.uncertaintyScore}%.` +
      (evidenceDensity != null ? ` Evidence density ${evidenceDensity}/100.` : ""),
    historicalChanges,
    reportId: report.clusterId,
  };
}
