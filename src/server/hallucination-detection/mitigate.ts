import type { EvidenceItem, ModelClaimVerdict, Verdict } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

const HALLUCINATION_SIGNAL =
  /\b(no evidence|cannot verify|not in (the )?passages|no matching|insufficient (data|evidence)|unable to confirm)\b/i;

const OVERCLAIM_SIGNAL =
  /\b(definitely|certainly|proven|undeniable|without doubt|100%|always true)\b/i;

const ALLOWED_VERDICTS: Verdict[] = [
  "supported",
  "disputed",
  "unclear",
  "insufficient_evidence",
];

export interface HallucinationMitigationResult {
  verdict: Verdict;
  confidence: number;
  applied: boolean;
  uncertaintyHandled: boolean;
  evidenceBackedOutput: boolean;
  aiDisagreementLevel: number;
  notes: string[];
}

function coerceVerdict(raw: string): Verdict {
  const v = raw as Verdict;
  return ALLOWED_VERDICTS.includes(v) ? v : "unclear";
}

/** Downgrade overconfident or unsupported outputs — epistemic labels only. */
export function applyHallucinationMitigation(input: {
  verdict: Verdict;
  confidence: number;
  claimText: string;
  evidence: EvidenceItem[];
  modelVerdicts: ModelClaimVerdict[];
}): HallucinationMitigationResult {
  let verdict = coerceVerdict(input.verdict);
  let confidence = clampScore(input.confidence);
  const notes: string[] = [];
  let applied = false;
  let uncertaintyHandled = false;

  const supporting = input.evidence.filter((e) => e.supports || e.stance === "support");
  const contradicting = input.evidence.filter((e) => e.stance === "contradict");

  let evidenceBackedOutput = false;

  if (input.evidence.length === 0) {
    if (verdict === "supported") {
      verdict = "insufficient_evidence";
      notes.push("No evidence passages — cannot support a supported label.");
      applied = true;
    }
    confidence = Math.min(confidence, 35);
    uncertaintyHandled = true;
    evidenceBackedOutput = false;
  }

  if (supporting.length === 0 && contradicting.length === 0 && verdict === "supported") {
    verdict = "unclear";
    confidence = Math.min(confidence, 42);
    notes.push("No supporting or contradicting evidence — downgraded to unclear.");
    applied = true;
    uncertaintyHandled = true;
  }

  const modelHay = input.modelVerdicts.map((m) => m.reasoning).join(" ");
  if (HALLUCINATION_SIGNAL.test(modelHay) && verdict === "supported") {
    verdict = "insufficient_evidence";
    confidence = Math.min(confidence, 48);
    notes.push("Model reasoning cites missing evidence — insufficient_evidence.");
    applied = true;
    uncertaintyHandled = true;
  }

  if (OVERCLAIM_SIGNAL.test(`${input.claimText} ${modelHay}`) && verdict === "supported") {
    confidence = Math.min(confidence, 55);
    notes.push("Absolute-truth phrasing capped — epistemic confidence reduced.");
    applied = true;
  }

  if (contradicting.length > 0 && supporting.length > 0 && verdict === "supported") {
    verdict = "disputed";
    confidence = Math.min(confidence, 60);
    notes.push("Contradicting evidence present — disputed label applied.");
    applied = true;
  }

  const activeModels = input.modelVerdicts.filter((m) => !m.skipped);
  const unique = new Set(activeModels.map((m) => m.verdict));
  const confidences = activeModels.map((m) => m.confidence);
  const spread =
    confidences.length >= 2 ? Math.max(...confidences) - Math.min(...confidences) : 0;

  if (unique.size >= 2) {
    const cap = Math.max(28, 58 - spread);
    confidence = Math.min(confidence, cap);
    notes.push(
      `High AI disagreement (${unique.size} verdicts, ${spread}pt confidence spread) — confidence reduced.`,
    );
    uncertaintyHandled = true;
    if (verdict === "supported") {
      verdict = spread >= 30 ? "disputed" : "unclear";
      applied = true;
    }
  }

  const avgModelConf =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : confidence;
  if (avgModelConf < 40) {
    confidence = Math.min(confidence, Math.round(avgModelConf + 8));
    notes.push("Low-confidence model reasoning — output confidence capped.");
    applied = true;
    uncertaintyHandled = true;
  }

  if (input.evidence.length > 0) {
    evidenceBackedOutput =
      supporting.length > 0 &&
      verdict !== "insufficient_evidence" &&
      !(unique.size >= 2 && spread >= 35);
  }

  const aiDisagreementLevel = Math.min(
    100,
    unique.size * 28 + Math.round(spread * 0.9),
  );

  return {
    verdict,
    confidence,
    applied,
    uncertaintyHandled,
    evidenceBackedOutput,
    aiDisagreementLevel,
    notes,
  };
}
