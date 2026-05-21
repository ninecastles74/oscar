import type { Claim } from "@/types/news-platform";
import type {
  ClassifiedClaim,
  ContradictionFinding,
  ScoredClaim,
} from "../analysis/verification/types";
import { buildClaimResearch } from "./build-research";
import type { ClaimResearchInput } from "./types";

export function attachResearchToScoredClaims(
  claims: ScoredClaim[],
  contradictions: ContradictionFinding[],
  contradictionAnalyses?: Record<string, import("@/types/news-platform").ContradictionAnalysisReport>,
): Claim[] {
  return claims.map((claim) => {
    const analysis = contradictionAnalyses?.[claim.id];
    const research = buildClaimResearch({
      claim,
      evidence: claim.evidence,
      contradictions,
    });
    if (analysis && research.scores) {
      research.scores.contradictionScore = Math.max(
        research.scores.contradictionScore,
        analysis.contradictionScore,
      );
    }
    return {
      ...claim,
      confidence: research.scores.finalConfidenceScore,
      verdict: research.verdict,
      claimResearch: research,
      sourceChainTrace: research.sourceChainTrace,
      contradictionAnalysis: analysis,
      reasoning: `${claim.reasoning ?? ""} Research: ${research.researchSummary}`.trim(),
    };
  });
}

export function researchClassifiedClaim(
  claim: ClassifiedClaim,
  evidence: ClaimResearchInput["evidence"],
  contradictions?: ContradictionFinding[],
) {
  return buildClaimResearch({ claim, evidence, contradictions });
}
