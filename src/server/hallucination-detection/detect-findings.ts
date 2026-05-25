import type { EvidenceItem, ModelClaimVerdict } from "@/types/news-platform";
import { detectUnsupportedCausalClaims } from "../contradiction/unsupported-causal";
import { detectUnsupportedStatistics } from "../contradiction/unsupported-statistics";
import { assessUnsupported } from "../research/sourcing-flags";
import type { ResearchEvidence } from "@/types/news-platform";
import { collectAiHallucinationSignals } from "./detect-ai-signals";
import type { HallucinationFinding, HallucinationSignalType } from "./types";

const MODEL_GAP =
  /\b(no evidence|cannot verify|not in (the )?passages|no matching|insufficient (data|evidence)|unable to confirm)\b/i;

const OVERCLAIM =
  /\b(definitely|certainly|proven|undeniable|without doubt|100%|always true)\b/i;

function push(
  findings: HallucinationFinding[],
  type: HallucinationSignalType,
  severity: HallucinationFinding["severity"],
  description: string,
): void {
  findings.push({ type, severity, description });
}

export function collectHallucinationFindings(input: {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
  modelVerdicts?: ModelClaimVerdict[];
  researchEvidence?: ResearchEvidence[];
  claimVerifiable?: boolean;
}): HallucinationFinding[] {
  const findings: HallucinationFinding[] = [];
  const supporting = input.evidence.filter((e) => e.supports || e.stance === "support");
  const contradicting = input.evidence.filter((e) => e.stance === "contradict");

  if (input.evidence.length === 0) {
    push(
      findings,
      "no_evidence",
      "critical",
      "No evidence passages linked to this claim.",
    );
  } else if (supporting.length === 0 && contradicting.length === 0) {
    push(
      findings,
      "weak_evidence_only",
      "warning",
      "Evidence present but none marked supporting or contradicting.",
    );
  }

  const modelHay = (input.modelVerdicts ?? []).map((m) => m.reasoning).join(" ");
  if (MODEL_GAP.test(modelHay)) {
    push(
      findings,
      "model_admits_gap",
      "warning",
      "Model reasoning acknowledges missing or insufficient evidence.",
    );
  }

  if (OVERCLAIM.test(`${input.claimText} ${modelHay}`)) {
    push(
      findings,
      "overconfident_phrasing",
      "info",
      "Absolute or certainty language detected without proportional hedging.",
    );
  }

  if (contradicting.length > 0 && supporting.length > 0) {
    push(
      findings,
      "contradicting_evidence",
      "warning",
      "Supporting and contradicting evidence coexist for the same claim.",
    );
  }

  const active = (input.modelVerdicts ?? []).filter((m) => !m.skipped);
  if (new Set(active.map((m) => m.verdict)).size >= 2) {
    push(
      findings,
      "model_disagreement",
      "warning",
      "Multiple models returned different verdict labels.",
    );
  }

  const stats = detectUnsupportedStatistics(input.claimId, input.claimText, input.evidence);
  for (const s of stats.findings) {
    push(findings, "unsupported_statistic", s.severity, s.description);
  }

  const causal = detectUnsupportedCausalClaims(input.claimId, input.claimText, input.evidence);
  for (const c of causal.findings) {
    push(findings, "unsupported_causal", c.severity, c.description);
  }

  if (input.researchEvidence?.length) {
    const unsupported = assessUnsupported(
      input.researchEvidence,
      input.claimVerifiable ?? true,
    );
    if (unsupported.isUnsupported) {
      push(findings, "unsupported_sourcing", "critical", unsupported.reason);
    }
  }

  const aiSignals = collectAiHallucinationSignals({
    claimText: input.claimText,
    evidence: input.evidence,
    modelVerdicts: input.modelVerdicts,
    researchEvidence: input.researchEvidence,
  });
  findings.push(...aiSignals);

  return findings;
}

export function computeHallucinationRiskScore(findings: HallucinationFinding[]): number {
  if (!findings.length) return 0;
  let score = 0;
  for (const f of findings) {
    if (f.severity === "critical") score += 28;
    else if (f.severity === "warning") score += 14;
    else score += 6;
  }
  return Math.min(100, score);
}
