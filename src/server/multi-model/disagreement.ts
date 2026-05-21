import type {
  ModelClaimVerdict,
  ModelDisagreement,
  ModelProviderId,
  Verdict,
} from "@/types/news-platform";
import { DISAGREEMENT_CONFIDENCE_SPREAD } from "./config";

export function detectDisagreements(
  claimId: string,
  verdicts: ModelClaimVerdict[],
): ModelDisagreement[] {
  const active = verdicts.filter((v) => !v.skipped);
  if (active.length < 2) return [];

  const uniqueVerdicts = [...new Set(active.map((v) => v.verdict))];
  const confidences = active.map((v) => v.confidence);
  const spread = Math.max(...confidences) - Math.min(...confidences);

  const disagreements: ModelDisagreement[] = [];

  if (uniqueVerdicts.length > 1) {
    const severity =
      uniqueVerdicts.includes("supported") && uniqueVerdicts.includes("disputed")
        ? "fundamental"
        : uniqueVerdicts.length >= 3
          ? "significant"
          : "minor";
    disagreements.push({
      claimId,
      providers: active.map((v) => v.provider),
      verdicts: uniqueVerdicts,
      confidenceSpread: spread,
      description: `Models disagree on verdict: ${uniqueVerdicts.join(" vs ")} (${active.map((v) => `${v.provider}=${v.verdict}`).join(", ")}).`,
      severity,
    });
  } else if (spread >= DISAGREEMENT_CONFIDENCE_SPREAD) {
    disagreements.push({
      claimId,
      providers: active.map((v) => v.provider),
      verdicts: uniqueVerdicts,
      confidenceSpread: spread,
      description: `Models agree on "${uniqueVerdicts[0]}" but confidence spread is ${spread} points.`,
      severity: spread >= 35 ? "significant" : "minor",
    });
  }

  return disagreements;
}

export function providersInvolved(verdicts: ModelClaimVerdict[]): ModelProviderId[] {
  return [...new Set(verdicts.filter((v) => !v.skipped).map((v) => v.provider))];
}
