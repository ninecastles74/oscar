import { buildClaimConsensus } from "@/server/consensus-engine";
import { arbitrateSingleClaim } from "@/server/multi-model/orchestrator";
import type { Claim, EvidenceItem, Verdict } from "@/types/news-platform";
import { applyHallucinationMitigation } from "./hallucination-guard";
import type {
  MultiModelArbitrationBatchInput,
  MultiModelArbitrationBatchJson,
  MultiModelArbitrationInput,
  MultiModelArbitrationJson,
  MultiModelWithClaimConsensusJson,
} from "./types";
import { MULTI_MODEL_DISCLAIMERS } from "./types";
import type { ReliabilityScoreBundle } from "./types";

function toArbitrationJson(
  verification: Awaited<ReturnType<typeof arbitrateSingleClaim>>["verification"],
  guard: ReturnType<typeof applyHallucinationMitigation>,
): MultiModelArbitrationJson {
  const summary = [
    verification.consensus.consensusSummary,
    ...(guard.notes.length ? guard.notes : []),
  ].join(" ");

  return {
    claimId: verification.claimId,
    claimText: verification.claimText,
    finalVerdict: guard.verdict,
    consensusConfidenceScore: guard.confidence,
    disagreementDetected: verification.consensus.disagreementDetected,
    arbitrationMethod: verification.consensus.arbitrationMethod,
    disagreements: verification.consensus.disagreements,
    modelVerdicts: verification.consensus.modelVerdicts,
    uncertaintyHandled: guard.uncertaintyHandled,
    hallucinationMitigationApplied: guard.applied,
    stagesRun: verification.stagesRun,
    consensusSummary: summary,
    disclaimers: MULTI_MODEL_DISCLAIMERS,
    computedAt: verification.computedAt,
  };
}

/**
 * Multi-Model Consensus Arbitration Engine
 *
 * 1. OpenAI primary reasoning
 * 2. Claude reviews disputed / uncertain claims
 * 3. Gemini low-cost corroboration
 * 4. (Optional) Claim consensus engine combines with research signals
 *
 * Returns structured JSON with epistemic labels only.
 */
export async function runMultiModelArbitration(
  input: MultiModelArbitrationInput,
): Promise<MultiModelArbitrationJson> {
  const pipelineVerdict = (input.pipelineVerdict ?? "unclear") as Verdict;
  const pipelineConfidence = input.pipelineConfidence ?? 50;

  const { verification } = await arbitrateSingleClaim(
    {
      id: input.claimId,
      text: input.claimText,
      verdict: pipelineVerdict,
      confidence: pipelineConfidence,
    },
    input.evidence,
    input.contradiction,
  );

  const guard = applyHallucinationMitigation({
    verdict: verification.consensus.finalVerdict,
    confidence: verification.consensus.finalConfidence,
    claimText: input.claimText,
    evidence: input.evidence,
    modelVerdicts: verification.consensus.modelVerdicts,
  });

  return toArbitrationJson(verification, guard);
}

/** Step 4: attach multi-model result and run claim consensus engine. */
export async function runMultiModelArbitrationWithClaimConsensus(input: {
  claim: Claim;
  evidence: EvidenceItem[];
  reliability?: ReliabilityScoreBundle | null;
}): Promise<MultiModelWithClaimConsensusJson> {
  const multiModelArbitration = await runMultiModelArbitration({
    claimId: input.claim.id,
    claimText: input.claim.text,
    evidence: input.evidence,
    pipelineVerdict: input.claim.verdict,
    pipelineConfidence: input.claim.confidence,
    contradiction: input.claim.contradictionAnalysis,
  });

  const claimWithMm: Claim = {
    ...input.claim,
    verdict: multiModelArbitration.finalVerdict,
    confidence: multiModelArbitration.consensusConfidenceScore,
    multiModelVerification: {
      claimId: input.claim.id,
      claimText: input.claim.text,
      consensus: {
        finalVerdict: multiModelArbitration.finalVerdict,
        finalConfidence: multiModelArbitration.consensusConfidenceScore,
        arbitrationMethod: multiModelArbitration.arbitrationMethod,
        disagreementDetected: multiModelArbitration.disagreementDetected,
        modelVerdicts: multiModelArbitration.modelVerdicts,
        disagreements: multiModelArbitration.disagreements,
        consensusSummary: multiModelArbitration.consensusSummary,
      },
      stagesRun: multiModelArbitration.stagesRun,
      computedAt: multiModelArbitration.computedAt,
    },
  };

  const claimConsensus = buildClaimConsensus(claimWithMm, input.reliability);

  return { multiModelArbitration, claimConsensus };
}

export async function runMultiModelArbitrationBatch(
  input: MultiModelArbitrationBatchInput,
): Promise<MultiModelArbitrationBatchJson> {
  const claims: MultiModelArbitrationJson[] = [];
  for (const c of input.claims) {
    claims.push(await runMultiModelArbitration(c));
  }

  const disagreementCount = claims.filter((c) => c.disagreementDetected).length;
  const overallConsensusConfidence =
    claims.length === 0
      ? 0
      : Math.round(
          claims.reduce((s, c) => s + c.consensusConfidenceScore, 0) / claims.length,
        );

  const modelsUsed = [
    ...new Set(
      claims.flatMap((c) =>
        c.modelVerdicts.filter((m) => !m.skipped).map((m) => m.provider),
      ),
    ),
  ];

  return {
    articleId: input.articleId,
    claims,
    overallConsensusConfidence,
    disagreementCount,
    modelsUsed,
    computedAt: new Date().toISOString(),
  };
}
