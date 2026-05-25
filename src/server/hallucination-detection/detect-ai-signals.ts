import type { EvidenceItem, ModelClaimVerdict } from "@/types/news-platform";
import type { ResearchEvidence } from "@/types/news-platform";
import type { HallucinationFinding } from "./types";

const FABRICATED_CITATION =
  /\b(source not found|invalid url|placeholder|example\.com|lorem ipsum|n\/a citation)\b/i;

const UNSUPPORTED_CONCLUSION =
  /\b(clearly shows|proves that|it is certain|we know that|established fact)\b/i;

function push(
  findings: HallucinationFinding[],
  type: HallucinationFinding["type"],
  severity: HallucinationFinding["severity"],
  description: string,
): void {
  findings.push({ type, severity, description });
}

/** AI-specific hallucination signals (citations, chains, model reasoning). */
export function collectAiHallucinationSignals(input: {
  claimText: string;
  evidence: EvidenceItem[];
  modelVerdicts?: ModelClaimVerdict[];
  researchEvidence?: ResearchEvidence[];
  modelReasoningHaystack?: string;
}): HallucinationFinding[] {
  const findings: HallucinationFinding[] = [];
  const modelHay =
    input.modelReasoningHaystack ??
    (input.modelVerdicts ?? []).map((m) => m.reasoning).join(" ");
  const active = (input.modelVerdicts ?? []).filter((m) => !m.skipped);

  for (const e of input.evidence) {
    const excerptLen = (e.excerpt ?? "").trim().length;
    const missingUrl = !e.url || e.url === "#" || e.url === "about:blank";
    const citedInReasoning = modelHay.includes(e.id) || modelHay.includes(e.citationLabel ?? "");
    if (excerptLen < 12 || missingUrl || FABRICATED_CITATION.test(e.excerpt)) {
      push(
        findings,
        "fabricated_citation",
        "critical",
        `Citation ${e.id} may be fabricated or placeholder (${e.sourceName ?? e.sourceId}).`,
      );
    } else if (!citedInReasoning && active.some((m) => m.verdict === "supported")) {
      push(
        findings,
        "fabricated_citation",
        "warning",
        `Evidence ${e.id} is not referenced in model reasoning despite a supported label.`,
      );
    }
  }

  const items = input.researchEvidence ?? input.evidence;
  const weakChain = items.filter((e) => {
    const re = e as ResearchEvidence;
    return (
      (e.dynamicWeight ?? 50) < 35 ||
      (re.weakSourcing === true) ||
      /\b(unsourced|anonymous|rumor|allegedly without)\b/i.test(e.excerpt)
    );
  });
  if (weakChain.length > 0 && weakChain.length >= input.evidence.length / 2) {
    push(
      findings,
      "weak_evidence_chain",
      "warning",
      `${weakChain.length} evidence item(s) form a weak or low-weight citation chain.`,
    );
  }

  const lowConf = active.filter((m) => m.confidence < 45);
  if (lowConf.length > 0) {
    push(
      findings,
      "low_confidence_reasoning",
      lowConf.length >= active.length / 2 ? "critical" : "warning",
      `${lowConf.length} model(s) reported low confidence (<45) in reasoning.`,
    );
  }

  const supportedModels = active.filter((m) => m.verdict === "supported");
  const noSupportEvidence =
    input.evidence.filter((e) => e.supports || e.stance === "support").length === 0;
  if (supportedModels.length > 0 && (noSupportEvidence || MODEL_GAP.test(modelHay))) {
    push(
      findings,
      "unsupported_ai_conclusion",
      "critical",
      "AI concluded supported without adequate supporting evidence passages.",
    );
  }

  if (UNSUPPORTED_CONCLUSION.test(`${input.claimText} ${modelHay}`) && noSupportEvidence) {
    push(
      findings,
      "unsupported_ai_conclusion",
      "warning",
      "Strong conclusion language without corroborating evidence.",
    );
  }

  return findings;
}

const MODEL_GAP =
  /\b(no evidence|cannot verify|not in (the )?passages|no matching|insufficient (data|evidence)|unable to confirm)\b/i;
