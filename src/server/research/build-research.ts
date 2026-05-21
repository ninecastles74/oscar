import type { ClaimResearchReport } from "@/types/news-platform";
import { aggregateEvidenceQuality, applyWeightsToResearchEvidence } from "../evidence-weighting";
import { buildSourceChainTrace } from "../source-chain/build-trace";
import { detectCopiedReporting } from "./copied-reporting";
import { classifyIndependence } from "./independence";
import { buildOriginChains } from "./origin-chains";
import { enrichAndPrioritizeEvidence, getPrimaryEvidence } from "./primary-evidence";
import { calculateResearchScores, verdictFromResearch } from "./score-calculator";
import {
  assessUnsupported,
  detectAnonymousSources,
  detectWeakSourcing,
} from "./sourcing-flags";
import type { ClaimResearchInput } from "./types";

/**
 * Claim research engine — multi-source evidence analysis with quality scoring.
 */
export function buildClaimResearch(input: ClaimResearchInput): ClaimResearchReport {
  const claimText = input.claim.text;
  const claimId = input.claim.id;
  const verifiable = "verifiable" in input.claim ? input.claim.verifiable !== false : true;

  let items = enrichAndPrioritizeEvidence(input.evidence);
  const { pairs: copiedReporting, items: afterCopy } = detectCopiedReporting(items);
  items = afterCopy;

  const { chains: originChains, items: afterChains } = buildOriginChains(items);
  items = afterChains;

  const { items: afterIndep, independentCount, repeatedCount } = classifyIndependence(
    items,
    copiedReporting,
  );
  items = afterIndep;

  const { items: afterWeak, flags: weakSourcing } = detectWeakSourcing(items, claimText);
  items = afterWeak;

  const { items: afterAnon, flags: anonymousSourceDependency } = detectAnonymousSources(
    items,
    claimText,
  );

  const finalItems = applyWeightsToResearchEvidence(afterAnon);
  const evidenceQuality = aggregateEvidenceQuality(finalItems);

  const unsupported = assessUnsupported(finalItems, verifiable);
  const claimContradictions =
    input.contradictions?.filter((c) => c.claimId === claimId) ?? [];
  const scores = calculateResearchScores(
    finalItems,
    independentCount,
    repeatedCount,
    weakSourcing.length,
    anonymousSourceDependency.length,
    unsupported.isUnsupported,
    claimContradictions.length,
  );

  const verdict = verdictFromResearch(scores, unsupported.isUnsupported);
  const primaryEvidence = getPrimaryEvidence(finalItems);

  const summaryParts = [
    `Researched ${finalItems.length} evidence item(s) from ${new Set(finalItems.map((e) => e.sourceId)).size} source(s).`,
    `${primaryEvidence.length} primary, ${independentCount} independent confirmation(s), ${repeatedCount} repeated/syndicated pattern(s).`,
    unsupported.isUnsupported
      ? `Unsupported: ${unsupported.reason}`
      : `Final confidence ${scores.finalConfidenceScore}/100 (${verdict}).`,
  ];

  if (copiedReporting.length > 0) {
    summaryParts.push(`${copiedReporting.length} copied-reporting pair(s) detected.`);
  }
  if (anonymousSourceDependency.length > 0) {
    summaryParts.push(`${anonymousSourceDependency.length} anonymous-source signal(s).`);
  }
  summaryParts.push(evidenceQuality.summary);

  const sourceChainTrace = buildSourceChainTrace({
    claimId,
    claimText,
    evidence: input.evidence,
  });
  summaryParts.push(sourceChainTrace.traceSummary);

  return {
    claimId,
    claimText,
    scores,
    verdict,
    primaryEvidence,
    allEvidence: finalItems,
    originChains,
    copiedReporting,
    independentConfirmationCount: independentCount,
    repeatedReportingCount: repeatedCount,
    weakSourcing,
    anonymousSourceDependency,
    unsupported,
    researchSummary: summaryParts.join(" "),
    sourceChainTrace,
    evidenceQuality,
    computedAt: new Date().toISOString(),
  };
}

export function buildClaimsResearch(
  inputs: ClaimResearchInput[],
): ClaimResearchReport[] {
  return inputs.map(buildClaimResearch);
}
