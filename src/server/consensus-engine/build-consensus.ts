import type {
  AnalysisReport,
  Claim,
  ClaimConsensusBatchReport,
  ClaimConsensusReport,
  ReliabilityScoreBundle,
  Verdict,
} from "@/types/news-platform";
import { CLAIM_CONSENSUS_DISCLAIMERS } from "@/types/news-platform";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { extractConsensusSignals } from "./signals";
import { resolveConsensusVerdict } from "./verdict-resolver";
import { clampScore } from "../reliability/utils/math";

/**
 * Claim consensus engine — combines evidence quality, AI reasoning, independence,
 * contradiction analysis, corroboration, and historical reliability.
 * Outputs epistemic labels only (never objective truth).
 */
export function buildClaimConsensus(
  claim: Claim,
  reliability?: ReliabilityScoreBundle | null,
): ClaimConsensusReport {
  const signals = extractConsensusSignals(claim, reliability);
  const research = claim.claimResearch;
  const resolved = resolveConsensusVerdict(claim.text, signals, {
    unsupported: research?.unsupported.isUnsupported,
    multiModelVerdict: claim.multiModelVerification?.consensus.finalVerdict,
    pipelineVerdict: claim.verdict,
    hasEvidenceConflict:
      (claim.contradictionAnalysis?.claimEvidenceConflicts.length ?? 0) > 0 ||
      (research?.scores?.contradictionScore ?? 0) >= 50,
  });

  return {
    claimId: claim.id,
    claimText: claim.text,
    verdict: resolved.verdict,
    confidence: resolved.confidence,
    compositeScore: signals.compositeScore,
    signals: signals.contributions,
    reasoning: resolved.reasoning,
    disclaimers: CLAIM_CONSENSUS_DISCLAIMERS,
    computedAt: new Date().toISOString(),
  };
}

export function buildClaimConsensusBatch(
  claims: Claim[],
  articleId: string,
  reliability?: ReliabilityScoreBundle | null,
): ClaimConsensusBatchReport {
  const reports = claims.map((c) => buildClaimConsensus(c, reliability));

  const verdictBreakdown: Record<Verdict, number> = {
    supported: 0,
    disputed: 0,
    unclear: 0,
    insufficient_evidence: 0,
  };
  for (const r of reports) {
    verdictBreakdown[r.verdict] += 1;
  }

  const overallConfidence =
    reports.length === 0
      ? 0
      : clampScore(reports.reduce((s, r) => s + r.confidence, 0) / reports.length);

  const summary = [
    `Consensus across ${reports.length} claim(s):`,
    `${verdictBreakdown.supported} supported, ${verdictBreakdown.disputed} disputed,`,
    `${verdictBreakdown.unclear} unclear, ${verdictBreakdown.insufficient_evidence} insufficient evidence.`,
    `Mean epistemic confidence ${overallConfidence}/100.`,
    CLAIM_CONSENSUS_DISCLAIMERS[0],
  ].join(" ");

  return {
    articleId,
    claims: reports,
    verdictBreakdown,
    overallConfidence,
    summary,
    disclaimers: CLAIM_CONSENSUS_DISCLAIMERS,
    computedAt: new Date().toISOString(),
  };
}

export function applyClaimConsensusToReport(
  report: AnalysisReport,
  reliability?: ReliabilityScoreBundle | null,
): AnalysisReport {
  const batch = buildClaimConsensusBatch(report.claims, report.id, reliability);
  const byId = new Map(batch.claims.map((c) => [c.claimId, c]));

  const claims = report.claims.map((claim) => {
    const consensus = byId.get(claim.id);
    if (!consensus) return claim;
    return {
      ...claim,
      verdict: consensus.verdict,
      confidence: consensus.confidence,
      claimConsensus: consensus,
      reasoning: [claim.reasoning, `Consensus: ${consensus.reasoning}`].filter(Boolean).join(" "),
    };
  });

  return {
    ...report,
    claims,
    overallConfidence: batch.overallConfidence,
    summary: `${report.summary} ${batch.summary}`,
    claimConsensus: batch,
  } as AnalysisReport & { claimConsensus?: ClaimConsensusBatchReport };
}

export function applyClaimConsensusToPipelineResults(
  results: VerificationPipelineResults,
  reliability?: ReliabilityScoreBundle | null,
): VerificationPipelineResults {
  const claims = results.scoredClaims as Claim[];
  const batch = buildClaimConsensusBatch(claims, results.article.submissionId, reliability);
  const byId = new Map(batch.claims.map((c) => [c.claimId, c]));

  const scoredClaims = results.scoredClaims.map((claim) => {
    const consensus = byId.get(claim.id);
    if (!consensus) return claim;
    return {
      ...claim,
      verdict: consensus.verdict,
      confidence: consensus.confidence,
      claimConsensus: consensus,
    };
  });

  return { ...results, scoredClaims };
}
