import type { ContradictionAnalysisReport } from "@/types/news-platform";
import type { ClassifiedClaim, ContradictionFinding, MissingContextFinding } from "../analysis/verification/types";
import { analyzeClaimVsEvidence } from "./claim-vs-evidence";
import { detectArticleDifferences } from "./article-differences";
import { detectConflictingReporting } from "./conflicting-reporting";
import { detectOmittedContext } from "./omitted-context";
import { detectTimelineInconsistencies } from "./timeline-inconsistencies";
import { detectUnsupportedCausalClaims } from "./unsupported-causal";
import { buildAnalysisSummary, computeContradictionScore } from "./score";
import type { ContradictionAnalysisInput, ContradictionBatchResult, PeerArticleSlice } from "./types";

/**
 * Contradiction analysis engine — claim/evidence, cross-article, timeline, causal.
 */
export function buildContradictionAnalysis(
  input: ContradictionAnalysisInput,
): ContradictionAnalysisReport {
  const claimId = input.claim.id;
  const claimText = input.claim.text;
  const evidence = input.evidence;

  const ce = analyzeClaimVsEvidence(claimId, claimText, evidence);
  const art = detectArticleDifferences(claimId, claimText, evidence, input.peerArticles);
  const conflict = detectConflictingReporting(claimId, evidence);
  const omit = detectOmittedContext(claimId, claimText, evidence);
  const timeline = detectTimelineInconsistencies(claimId, claimText, evidence);
  const causal = detectUnsupportedCausalClaims(claimId, claimText, evidence);

  const issues = [
    ...ce.issues,
    ...art.issues,
    ...conflict.issues,
    ...omit.issues,
    ...timeline.issues,
    ...causal.issues,
  ];

  const draft = {
    claimId,
    claimText,
    issues,
    claimEvidenceConflicts: ce.conflicts,
    articleDifferences: art.differences,
    conflictingReporting: conflict.findings,
    omittedContext: omit.findings,
    timelineInconsistencies: timeline.inconsistencies,
    unsupportedCausalClaims: causal.findings,
    contradictionScore: 0,
    analysisSummary: "",
    computedAt: new Date().toISOString(),
  };

  draft.contradictionScore = computeContradictionScore(issues, draft);
  draft.analysisSummary = buildAnalysisSummary(draft as ContradictionAnalysisReport);

  return draft as ContradictionAnalysisReport;
}

export function runContradictionAnalysisBatch(
  claims: ClassifiedClaim[],
  evidenceByClaimId: Record<string, import("@/types/news-platform").EvidenceItem[]>,
  peerArticles?: PeerArticleSlice[],
): ContradictionBatchResult {
  const byClaimId: Record<string, ContradictionAnalysisReport> = {};
  const contradictions: ContradictionFinding[] = [];
  const missingContext: MissingContextFinding[] = [];

  for (const claim of claims) {
    const report = buildContradictionAnalysis({
      claim,
      evidence: evidenceByClaimId[claim.id] ?? [],
      peerArticles,
    });
    byClaimId[claim.id] = report;

    for (const c of report.claimEvidenceConflicts) {
      if (c.contradictingEvidenceIds.length === 0) continue;
      const supId = c.supportingEvidenceIds[0];
      const conId = c.contradictingEvidenceIds[0];
      const evidence = evidenceByClaimId[claim.id] ?? [];
      const a = evidence.find((e) => e.id === supId) ?? evidence.find((e) => e.stance === "support");
      const b = evidence.find((e) => e.id === conId) ?? evidence.find((e) => e.stance === "contradict");
      if (a && b) {
        contradictions.push({
          claimId: claim.id,
          description: c.description,
          evidenceIds: [a.id, b.id],
          sourceIds: [a.sourceId, b.sourceId],
          severity: c.severity,
        });
      }
    }

    for (const cr of report.conflictingReporting) {
      if (contradictions.some((x) => x.claimId === claim.id)) continue;
      const evidence = evidenceByClaimId[claim.id] ?? [];
      const a = evidence.find((e) => cr.supportingSources.includes(e.sourceId));
      const b = evidence.find((e) => cr.contradictingSources.includes(e.sourceId));
      if (a && b) {
        contradictions.push({
          claimId: claim.id,
          description: cr.description,
          evidenceIds: [a.id, b.id],
          sourceIds: [a.sourceId, b.sourceId],
          severity: cr.severity,
        });
      }
    }

    for (const o of report.omittedContext) {
      missingContext.push({
        claimId: claim.id,
        description: o.description,
        evidenceIds: o.evidenceIds,
      });
    }
  }

  return { byClaimId, contradictions, missingContext };
}
