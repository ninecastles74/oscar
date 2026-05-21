import type {
  MultiModelClaimVerification,
  MultiModelConsensus,
  ModelClaimVerdict,
  Verdict,
} from "@/types/news-platform";
import { arbitrateConsensus } from "./arbitration";
import { detectDisagreements } from "./disagreement";

export function buildMultiModelConsensus(
  claimId: string,
  claimText: string,
  modelVerdicts: ModelClaimVerdict[],
  evidenceFallback: { verdict: Verdict; confidence: number },
): MultiModelConsensus {
  const disagreements = detectDisagreements(claimId, modelVerdicts);
  const arbitration = arbitrateConsensus(
    claimId,
    modelVerdicts,
    disagreements,
    evidenceFallback,
  );

  const summaryParts = [arbitration.consensusSummary];
  if (disagreements.length > 0) {
    summaryParts.push(
      `${disagreements.length} disagreement(s): ${disagreements.map((d) => d.description).join(" ")}`,
    );
  }

  return {
    finalVerdict: arbitration.finalVerdict,
    finalConfidence: arbitration.finalConfidence,
    arbitrationMethod: arbitration.arbitrationMethod,
    disagreementDetected: disagreements.length > 0,
    modelVerdicts,
    disagreements,
    consensusSummary: summaryParts.join(" "),
  };
}

export function toClaimVerification(
  claimId: string,
  claimText: string,
  consensus: MultiModelConsensus,
  stagesRun: string[],
): MultiModelClaimVerification {
  return {
    claimId,
    claimText,
    consensus,
    stagesRun,
    computedAt: new Date().toISOString(),
  };
}
