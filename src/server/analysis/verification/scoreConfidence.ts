import type { EvidenceItem, Verdict } from "@/types/news-platform";
import { supportingWeightSum } from "../../evidence-weighting";
import type {
  ClassifiedClaim,
  ContradictionFinding,
  MissingContextFinding,
  ScoredClaim,
} from "./types";
import { VERDICT_LABELS } from "./types";

function countStances(evidence: EvidenceItem[]) {
  return {
    support: evidence.filter((e) => e.stance === "support").length,
    contradict: evidence.filter((e) => e.stance === "contradict").length,
    neutral: evidence.filter((e) => e.stance === "neutral").length,
  };
}

function weightedSupportScore(evidence: EvidenceItem[]): number {
  return supportingWeightSum(evidence);
}

function buildReasoning(
  verdict: Verdict,
  evidence: EvidenceItem[],
  citationIds: string[],
  contradictions: ContradictionFinding[],
  missing: MissingContextFinding[],
): string {
  const cites =
    citationIds.length > 0
      ? ` Evidence cited: ${citationIds.map((id) => `[${id}]`).join(", ")}.`
      : " No citable passages from approved sources.";

  const contra = contradictions[0];
  const miss = missing[0];
  let extra = "";
  if (contra) extra += ` ${contra.description}`;
  if (miss) extra += ` ${miss.description}`;

  return `Label: ${VERDICT_LABELS[verdict]}.${cites}${extra}`.trim();
}

/**
 * 7. scoreConfidence — per-claim verdict + percentage; every label tied to evidence.
 */
export function scoreConfidence(
  claims: ClassifiedClaim[],
  evidenceByClaimId: Record<string, EvidenceItem[]>,
  contradictions: ContradictionFinding[],
  missingContext: MissingContextFinding[],
): ScoredClaim[] {
  return claims.map((claim) => {
    const evidence = evidenceByClaimId[claim.id] ?? [];
    const { support, contradict, neutral } = countStances(evidence);
    const weighted = weightedSupportScore(evidence);
    const claimContras = contradictions.filter((c) => c.claimId === claim.id);
    const claimMissing = missingContext.filter((m) => m.claimId === claim.id);

    let verdict: Verdict;
    let confidence: number;

    if (!claim.verifiable) {
      verdict = "unclear";
      confidence = 35;
    } else if (support === 0 && contradict === 0) {
      verdict = "insufficient_evidence";
      confidence = Math.min(40, 15 + neutral * 5);
    } else if (support >= 1 && contradict >= 1) {
      verdict = "disputed";
      const total = support + contradict;
      confidence = Math.round(50 + (Math.abs(support - contradict) / total) * 25);
    } else if (support >= 2 && contradict === 0 && weighted >= 120) {
      verdict = "supported";
      confidence = Math.min(95, 60 + Math.round(weighted / 20));
    } else if (support >= 1 && contradict === 0) {
      verdict = "supported";
      confidence = Math.min(78, 48 + support * 8 + Math.round(weighted / 30));
    } else if (contradict >= 2 && support === 0) {
      verdict = "disputed";
      confidence = Math.min(88, 55 + contradict * 10);
    } else if (neutral > support + contradict || HEDGE(claim.text)) {
      verdict = "unclear";
      confidence = 42 + neutral * 3;
    } else {
      verdict = "insufficient_evidence";
      confidence = 30 + support * 5;
    }

    if (claimMissing.length > 0 && verdict === "supported") {
      verdict = "unclear";
      confidence = Math.min(confidence, 62);
    }

    const citationIds = evidence
      .filter((e) => e.stance !== "neutral" || verdict === "insufficient_evidence")
      .map((e) => e.id)
      .slice(0, 5);

    const reasoning = buildReasoning(verdict, evidence, citationIds, claimContras, claimMissing);

    const context =
      claimMissing[0]?.description ?? (claimContras[0] ? claimContras[0].description : undefined);

    const scored: ScoredClaim = {
      id: claim.id,
      text: claim.text,
      verdict,
      confidence,
      evidence,
      reasoning,
      context,
      citationIds,
      topicClassification: claim.topicClassification,
    };

    return scored;
  });
}

function HEDGE(text: string): boolean {
  return /\b(may|might|could|possibly|unclear|unknown|debate)\b/i.test(text);
}
