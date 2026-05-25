import type { Verdict } from "@/types/news-platform";
import { assessUnsupported } from "../research/sourcing-flags";
import { collectHallucinationFindings, computeHallucinationRiskScore } from "./detect-findings";
import { applyHallucinationMitigation } from "./mitigate";
import { computeAiDisagreementLevel, computeUnsupportedReasoningScore } from "./scoring";
import type { HallucinationDetectionInput, HallucinationDetectionReport } from "./types";

/**
 * AI Hallucination Detection Layer — flags unsupported conclusions, fabricated
 * citations, weak evidence chains, and low-confidence reasoning; requires
 * evidence-backed outputs and reduces confidence under model disagreement.
 */
export function buildHallucinationDetectionReport(
  input: HallucinationDetectionInput,
): HallucinationDetectionReport {
  const findings = collectHallucinationFindings(input);
  const hallucinationRiskScore = computeHallucinationRiskScore(findings);

  const baseVerdict = (input.pipelineVerdict ?? "unclear") as Verdict;
  const baseConfidence = input.pipelineConfidence ?? 50;

  const mitigation = applyHallucinationMitigation({
    verdict: baseVerdict,
    confidence: baseConfidence,
    claimText: input.claimText,
    evidence: input.evidence,
    modelVerdicts: input.modelVerdicts ?? [],
  });

  const unsupportedAssessment = input.researchEvidence?.length
    ? assessUnsupported(input.researchEvidence, input.claimVerifiable ?? true)
    : null;

  const active = (input.modelVerdicts ?? []).filter((m) => !m.skipped);
  const avgModelConfidence =
    active.length > 0
      ? active.reduce((s, m) => s + m.confidence, 0) / active.length
      : baseConfidence;

  const unsupportedReasoningScore = computeUnsupportedReasoningScore(findings, {
    unsupportedAssessment: unsupportedAssessment?.isUnsupported,
    avgModelConfidence,
  });

  const aiDisagreementLevel =
    mitigation.aiDisagreementLevel ||
    computeAiDisagreementLevel(
      active.map((m) => m.verdict),
      active.map((m) => m.confidence),
    );

  const isLikelyHallucination =
    hallucinationRiskScore >= 55 ||
    unsupportedReasoningScore >= 50 ||
    mitigation.verdict === "insufficient_evidence" ||
    unsupportedAssessment?.isUnsupported === true;

  return {
    claimId: input.claimId,
    claimText: input.claimText,
    hallucinationRiskScore,
    unsupportedReasoningScore,
    isLikelyHallucination,
    adjustedVerdict: mitigation.verdict,
    adjustedConfidence: mitigation.confidence,
    findings,
    mitigationApplied: mitigation.applied,
    uncertaintyHandled: mitigation.uncertaintyHandled,
    evidenceBackedOutput: mitigation.evidenceBackedOutput,
    aiDisagreementLevel,
    notes: mitigation.notes,
    unsupportedAssessment,
    computedAt: new Date().toISOString(),
  };
}

/** Entry point for the AI Hallucination Detection Layer (same structured JSON). */
export const buildAiHallucinationDetectionReport = buildHallucinationDetectionReport;
