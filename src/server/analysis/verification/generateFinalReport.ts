import type {
  AnalysisReport,
  IssueFlag,
  IssueSummary,
  SourceComparison,
} from "@/types/news-platform";
import { APPROVED_SOURCES } from "../sources";
import { CLAIM_EVIDENCE_FAILED_WARNING } from "./evidence-messages";
import type { PipelineArticleContext } from "../types";
import type {
  ContradictionFinding,
  MissingContextFinding,
  ScoredClaim,
  VerificationPipelineResults,
} from "./types";

function buildIssueFlags(
  scoredClaims: ScoredClaim[],
  contradictions: ContradictionFinding[],
  missingContext: MissingContextFinding[],
): IssueFlag[] {
  const flags: IssueFlag[] = [];

  for (const c of contradictions) {
    flags.push({
      type: "contradiction",
      description: c.description,
      severity: c.severity === "fundamental" ? "critical" : "warning",
      claimId: c.claimId,
      sourceIds: [...c.sourceIds],
    });
  }

  for (const m of missingContext) {
    flags.push({
      type: "missing_context",
      description: m.description,
      severity: "info",
      claimId: m.claimId,
    });
  }

  for (const claim of scoredClaims) {
    if (claim.verdict === "insufficient_evidence") {
      flags.push({
        type: "unsupported_claim",
        description: claim.context?.includes("Live evidence retrieval failed")
          ? CLAIM_EVIDENCE_FAILED_WARNING
          : `Insufficient evidence from approved sources.`,
        severity: "info",
        claimId: claim.id,
      });
    }
    if (claim.verdict === "unclear") {
      flags.push({
        type: "emotional_language",
        description: "Claim wording or source signals are ambiguous; review cited passages.",
        severity: "info",
        claimId: claim.id,
      });
    }
  }

  return flags;
}

function buildIssueSummary(scoredClaims: ScoredClaim[], flags: IssueFlag[]): IssueSummary {
  return {
    contradictions: flags.filter((f) => f.type === "contradiction").length,
    missingContext: flags.filter((f) => f.type === "missing_context").length,
    emotionalLanguage: flags.filter((f) => f.type === "emotional_language").length,
    unsupportedClaims: scoredClaims.filter((c) => c.verdict === "insufficient_evidence").length,
    totalClaims: scoredClaims.length,
  };
}

function attachContradictionsToComparisons(
  comparisons: SourceComparison[],
  contradictions: ContradictionFinding[],
): SourceComparison[] {
  return comparisons.map((comp) => {
    const related = contradictions.filter((c) => c.claimId === comp.claimId);
    return {
      ...comp,
      contradictions: related.map((r) => ({
        sourceIds: r.sourceIds,
        description: r.description,
        severity: r.severity,
      })),
    };
  });
}

/**
 * 8. generateFinalReport — structured JSON; per-claim only (no article true/false).
 */
export function generateFinalReport(results: VerificationPipelineResults): AnalysisReport {
  const {
    article,
    scoredClaims,
    comparisons,
    contradictions,
    missingContext,
    startedAt,
    articleTopicClassification,
    pipelineWarnings,
  } = results;

  const issueFlags = buildIssueFlags(scoredClaims, contradictions, missingContext);
  const issueSummary = buildIssueSummary(scoredClaims, issueFlags);
  const enrichedComparisons = attachContradictionsToComparisons(comparisons, contradictions);

  const byVerdict = scoredClaims.reduce(
    (acc, c) => {
      acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const overallConfidence =
    scoredClaims.length === 0
      ? 0
      : Math.round(scoredClaims.reduce((s, c) => s + c.confidence, 0) / scoredClaims.length);

  const summaryParts = [
    `This report evaluates ${scoredClaims.length} individual claim(s) from the article — not the article as a whole.`,
    `${byVerdict.supported ?? 0} Supported, ${byVerdict.disputed ?? 0} Disputed, ${byVerdict.unclear ?? 0} Unclear, ${byVerdict.insufficient_evidence ?? 0} Insufficient Evidence.`,
    "Each label is tied to cited passages from approved sources.",
    article.rightsNote,
  ];

  const citedIds = new Set<string>();
  for (const c of scoredClaims) {
    for (const e of c.evidence) citedIds.add(e.sourceId);
  }
  const sources = APPROVED_SOURCES.filter((s) => citedIds.has(s.id));
  const usedSources = sources.length > 0 ? sources : APPROVED_SOURCES.slice(0, 6);

  return {
    id: `report-${article.submissionId}`,
    title: article.title,
    urlOrClusterId: article.url,
    overallConfidence,
    summary: summaryParts.join(" "),
    claims: scoredClaims as import("@/types/news-platform").Claim[],
    sources: usedSources,
    sourceComparisons: enrichedComparisons,
    issueSummary,
    issueFlags,
    topicClassification: articleTopicClassification,
    generatedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startedAt,
    pipelineWarnings,
  };
}
