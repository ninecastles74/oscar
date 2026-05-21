import type {
  ArbitrationMethod,
  ModelClaimVerdict,
  ModelDisagreement,
  Verdict,
} from "@/types/news-platform";
import { MODEL_WEIGHTS } from "./config";
import { clampScore } from "../reliability/utils/math";

const VERDICT_ORDER: Verdict[] = [
  "supported",
  "unclear",
  "insufficient_evidence",
  "disputed",
];

function weightForVerdict(v: ModelClaimVerdict): number {
  if (v.skipped) return 0;
  if (v.role === "primary") return MODEL_WEIGHTS.primary;
  if (v.role === "review") return MODEL_WEIGHTS.review;
  return MODEL_WEIGHTS.corroboration;
}

export interface ArbitrationResult {
  finalVerdict: Verdict;
  finalConfidence: number;
  arbitrationMethod: ArbitrationMethod;
  consensusSummary: string;
}

/**
 * Arbitration logic — weighted majority, review mediator, evidence fallback.
 */
export function arbitrateConsensus(
  claimId: string,
  verdicts: ModelClaimVerdict[],
  disagreements: ModelDisagreement[],
  evidenceFallback: { verdict: Verdict; confidence: number },
): ArbitrationResult {
  const active = verdicts.filter((v) => !v.skipped);
  if (active.length === 0) {
    return {
      finalVerdict: evidenceFallback.verdict,
      finalConfidence: evidenceFallback.confidence,
      arbitrationMethod: "evidence_fallback",
      consensusSummary: "No model responses; used evidence-weighted pipeline verdict.",
    };
  }

  const uniqueVerdicts = [...new Set(active.map((v) => v.verdict))];

  if (uniqueVerdicts.length === 1) {
    const avg =
      active.reduce((s, v) => s + v.confidence * weightForVerdict(v), 0) /
      active.reduce((s, v) => s + weightForVerdict(v), 0);
    return {
      finalVerdict: uniqueVerdicts[0],
      finalConfidence: clampScore(avg),
      arbitrationMethod: "unanimous",
      consensusSummary: `Unanimous ${uniqueVerdicts[0]} across ${active.length} model(s).`,
    };
  }

  const byVerdict = new Map<Verdict, { weight: number; confSum: number }>();
  for (const v of active) {
    const w = weightForVerdict(v);
    const cur = byVerdict.get(v.verdict) ?? { weight: 0, confSum: 0 };
    cur.weight += w;
    cur.confSum += v.confidence * w;
    byVerdict.set(v.verdict, cur);
  }

  const ranked = [...byVerdict.entries()].sort((a, b) => b[1].weight - a[1].weight);
  const [topVerdict, topData] = ranked[0];
  const second = ranked[1];

  if (!second || topData.weight >= second[1].weight + 0.12) {
    return {
      finalVerdict: topVerdict,
      finalConfidence: clampScore(topData.confSum / topData.weight),
      arbitrationMethod: "weighted_majority",
      consensusSummary: `Weighted majority: ${topVerdict} (${Math.round(topData.weight * 100)}% model weight).`,
    };
  }

  const primary = active.find((v) => v.role === "primary");
  const review = active.find((v) => v.role === "review");

  if (primary && review && primary.verdict !== review.verdict) {
    const useReview =
      review.confidence >= primary.confidence - 5 &&
      disagreements.some((d) => d.severity !== "minor");
    if (useReview) {
      return {
        finalVerdict: review.verdict,
        finalConfidence: clampScore(
          review.confidence * MODEL_WEIGHTS.review +
            (active.find((v) => v.role === "corroboration")?.confidence ?? review.confidence) *
              MODEL_WEIGHTS.corroboration,
        ),
        arbitrationMethod: "review_mediator",
        consensusSummary: `Claude review mediated dispute (primary: ${primary.verdict}, review: ${review.verdict}).`,
      };
    }
    return {
      finalVerdict: primary.verdict,
      finalConfidence: clampScore(primary.confidence * 0.85),
      arbitrationMethod: "primary_override",
      consensusSummary: `OpenAI primary retained after split with review (${review.verdict}).`,
    };
  }

  const conservative = pickConservativeVerdict(active.map((v) => v.verdict));
  const conf =
    active.filter((v) => v.verdict === conservative).reduce((s, v) => s + v.confidence, 0) /
    Math.max(1, active.filter((v) => v.verdict === conservative).length);

  return {
    finalVerdict: conservative,
    finalConfidence: clampScore(Math.min(conf, evidenceFallback.confidence + 10)),
    arbitrationMethod: "evidence_fallback",
    consensusSummary: `Split decision — conservative ${conservative} with evidence pipeline input.`,
  };
}

function pickConservativeVerdict(verdicts: Verdict[]): Verdict {
  let best: Verdict = "insufficient_evidence";
  let bestIdx = -1;
  for (const v of verdicts) {
    const idx = VERDICT_ORDER.indexOf(v);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = v;
    }
  }
  return best;
}
