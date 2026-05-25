import type { HallucinationFinding, HallucinationSignalType } from "./types";

const UNSUPPORTED_REASONING_TYPES: Set<HallucinationSignalType> = new Set([
  "unsupported_ai_conclusion",
  "fabricated_citation",
  "weak_evidence_chain",
  "low_confidence_reasoning",
  "model_admits_gap",
  "model_disagreement",
  "unsupported_sourcing",
  "no_evidence",
  "weak_evidence_only",
]);

export function computeUnsupportedReasoningScore(
  findings: HallucinationFinding[],
  options?: { unsupportedAssessment?: boolean; avgModelConfidence?: number },
): number {
  let score = 0;
  for (const f of findings) {
    if (!UNSUPPORTED_REASONING_TYPES.has(f.type)) continue;
    if (f.severity === "critical") score += 24;
    else if (f.severity === "warning") score += 14;
    else score += 7;
  }
  if (options?.unsupportedAssessment) score += 22;
  if (options?.avgModelConfidence != null && options.avgModelConfidence < 45) {
    score += Math.round((45 - options.avgModelConfidence) * 0.6);
  }
  return Math.min(100, score);
}

export function computeAiDisagreementLevel(
  verdicts: string[],
  confidences: number[],
): number {
  if (verdicts.length < 2) return 0;
  const uniqueVerdicts = new Set(verdicts).size;
  const spread =
    confidences.length >= 2
      ? Math.max(...confidences) - Math.min(...confidences)
      : 0;
  return Math.min(100, uniqueVerdicts * 28 + Math.round(spread * 0.9));
}
