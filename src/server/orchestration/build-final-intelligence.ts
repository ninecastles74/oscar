import type { Claim, Verdict } from "@/types/news-platform";
import { aggregateEvidenceQuality, weightEvidenceItems } from "../evidence-weighting";
import { alignClaimsAcrossArticles } from "../consensus/claim-alignment";
import { analyzeNarrativeDifferences } from "../consensus/narrative-analysis";
import { buildClaimConsensus } from "../consensus-engine";
import { buildContradictionAnalysis } from "../contradiction";
import { buildHallucinationDetectionReport } from "../hallucination-detection";
import { buildNarrativeFramingIntelligenceReport } from "../framing-intelligence/build-report";
import { computeHistoricalReliabilityScore } from "../reliability/historical-score";
import { clampScore } from "../reliability/utils/math";
import { buildSourceChainTrace } from "../source-chain/build-trace";
import { arbitrateSingleClaim } from "../multi-model/orchestrator";
import { runArticleAnalysisOrchestration } from "./run-article";
import { getArticleBundle } from "../news/feed-store";
import { stableArticleId } from "../news/utils/text";
import { runClusterAnalysisOrchestration } from "./run-cluster";
import {
  FINAL_INTELLIGENCE_DISCLAIMER,
  type FinalClaimSignalSummary,
  type FinalIntelligenceInput,
  type FinalIntelligenceReport,
  type OrchestrationStage,
} from "./final-intelligence-types";
import type { AnalyzedArticleBundle } from "../consensus/types";

function average(nums: number[]): number {
  if (!nums.length) return 50;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function independenceFromTrace(claim: Claim): number {
  const trace = buildSourceChainTrace({
    claimId: claim.id,
    claimText: claim.text,
    evidence: claim.evidence,
  });
  const nodes = trace.reportingDependencyMap.nodes.length;
  const circularCount = trace.circularReporting.length;
  const wireCount = trace.wirePropagation.length;
  let score = 55 + Math.min(25, nodes * 4);
  score -= circularCount * 15;
  score -= wireCount * 8;
  score -= trace.repeatedOriginalSourceGroups.length * 10;
  return clampScore(score);
}

async function runClaimIntelligencePass(
  claim: Claim,
  reliability: import("@/types/news-platform").ReliabilityScoreBundle,
  trigger: FinalIntelligenceInput["trigger"],
): Promise<FinalClaimSignalSummary> {
  const weighted = weightEvidenceItems(claim.evidence);
  const evidenceQualityScore = aggregateEvidenceQuality(weighted).aggregateScore;

  const contradiction = claim.contradictionAnalysis
    ? { contradictionScore: claim.contradictionAnalysis.contradictionScore ?? 0 }
    : buildContradictionAnalysis({
        claim: { id: claim.id, text: claim.text },
        evidence: claim.evidence,
      });

  let consensusVerdict = claim.claimConsensus?.verdict ?? claim.verdict;
  let consensusConfidence =
    claim.claimConsensus?.confidence ?? claim.confidence ?? 50;

  if (
    !claim.multiModelVerification &&
    claim.evidence.length > 0 &&
    trigger !== "scheduled" &&
    process.env.FINAL_INTELLIGENCE_ON_MANUAL === "true"
  ) {
    try {
      const { verification } = await arbitrateSingleClaim(
        {
          id: claim.id,
          text: claim.text,
          verdict: claim.verdict,
          confidence: claim.confidence,
        },
        claim.evidence,
        claim.contradictionAnalysis,
      );
      const mitigated = buildHallucinationDetectionReport({
        claimId: claim.id,
        claimText: claim.text,
        evidence: claim.evidence,
        modelVerdicts: verification.consensus.modelVerdicts,
        pipelineVerdict: verification.consensus.finalVerdict,
        pipelineConfidence: verification.consensus.finalConfidence,
      });
      consensusVerdict = mitigated.adjustedVerdict;
      consensusConfidence = mitigated.adjustedConfidence;
    } catch {
      /* multi-model optional */
    }
  }

  const consensus = buildClaimConsensus(
    {
      ...claim,
      verdict: consensusVerdict,
      confidence: consensusConfidence,
    },
    reliability,
  );

  const hallucination = buildHallucinationDetectionReport({
    claimId: claim.id,
    claimText: claim.text,
    evidence: claim.evidence,
    modelVerdicts: claim.multiModelVerification?.consensus.modelVerdicts,
    researchEvidence: claim.claimResearch?.allEvidence,
    pipelineVerdict: consensus.verdict,
    pipelineConfidence: consensus.confidence,
  });

  return {
    claimId: claim.id,
    evidenceQualityScore,
    sourceIndependenceScore: independenceFromTrace(claim),
    contradictionScore: contradiction.contradictionScore ?? 0,
    hallucinationRiskScore: hallucination.hallucinationRiskScore,
    consensusVerdict: consensus.verdict,
    consensusConfidence: consensus.confidence,
  };
}

function bundleFromArticleResult(
  articleResult: import("./types").ArticleOrchestrationReport,
  ctx: FinalIntelligenceInput["article"],
): AnalyzedArticleBundle {
  const orgId = articleResult.reliability.organization?.organizationId;
  return {
    articleId: articleResult.articleId,
    url: ctx.url,
    title: ctx.title,
    sourceId: orgId ?? "article",
    sourceName: articleResult.reliability.organization?.name ?? "Article",
    sourceDomain: articleResult.reliability.organization?.domain ?? "unknown",
    analysisText: ctx.analysisText,
    report: articleResult.report,
    results: articleResult.results,
  };
}

/**
 * Final Intelligence Orchestration Layer — coordinates all analysis engines and
 * emits consolidated epistemic scores (never objective truth claims).
 */
export async function buildFinalIntelligenceReport(
  input: FinalIntelligenceInput,
): Promise<FinalIntelligenceReport> {
  const enginesRun: OrchestrationStage[] = [];

  const article =
    input.articleResult ??
    (await runArticleAnalysisOrchestration({
      article: input.article,
      trigger: input.trigger,
      skipMultiModel: input.skipMultiModel,
      reportId: input.reportId,
      authorDisplayName: input.authorDisplayName,
    }));

  enginesRun.push(
    "verification",
    "multi_model",
    "reliability",
    "claim_consensus",
    "explainability",
    "transparency",
  );

  const claimSignals: FinalClaimSignalSummary[] = [];
  for (const claim of article.report.claims) {
    claimSignals.push(
      await runClaimIntelligencePass(claim, article.reliability, input.trigger),
    );
  }
  enginesRun.push(
    "evidence_weighting",
    "source_tracing",
    "contradiction_analysis",
    "consensus_arbitration",
    "historical_reliability",
    "hallucination_detection",
  );

  const historicalScore = computeHistoricalReliabilityScore(article.reliability);
  enginesRun.push("historical_reliability");

  let cluster = input.clusterResult;
  if (input.cluster && !cluster) {
    cluster = await runClusterAnalysisOrchestration(input.cluster);
    enginesRun.push("story_consensus", "story_intelligence", "narrative_analysis");
  } else if (cluster) {
    enginesRun.push("story_consensus", "story_intelligence");
  }

  if (cluster && cluster.storyIntelligence) {
    enginesRun.push("narrative_analysis");
  } else if (input.cluster) {
    const bundles = input.cluster.articles
      .slice(0, 12)
      .map((a) => getArticleBundle(a.id || stableArticleId(a.url)))
      .filter((b): b is AnalyzedArticleBundle => !!b);
    if (bundles.length === 1) {
      bundles.push(bundleFromArticleResult(article, input.article));
    }
    if (bundles.length >= 1) {
      const aligned = alignClaimsAcrossArticles(bundles);
      analyzeNarrativeDifferences(bundles, aligned);
      buildNarrativeFramingIntelligenceReport({ articles: bundles });
      enginesRun.push("narrative_analysis");
    }
  }

  const avgEvidence = average(claimSignals.map((c) => c.evidenceQualityScore));
  const avgIndependence = average(claimSignals.map((c) => c.sourceIndependenceScore));
  const avgHallucination = average(claimSignals.map((c) => c.hallucinationRiskScore));
  const avgContradiction = average(claimSignals.map((c) => c.contradictionScore));
  const avgConsensusConf = average(claimSignals.map((c) => c.consensusConfidence));

  const unclearShare =
    claimSignals.filter(
      (c) =>
        c.consensusVerdict === "unclear" || c.consensusVerdict === "insufficient_evidence",
    ).length / Math.max(1, claimSignals.length);

  const finalArticleReliability = clampScore(
    article.reliability.article.overallScore * 0.35 +
      avgEvidence * 0.2 +
      avgIndependence * 0.15 +
      historicalScore * 0.15 +
      (100 - avgHallucination) * 0.1 +
      (100 - avgContradiction) * 0.05,
  );

  const finalSourceReliability = article.reliability.organization?.overallScore ?? null;
  const finalAuthorReliability = article.reliability.author?.overallScore ?? null;

  const finalStoryConfidence = cluster
    ? clampScore(
        cluster.storyConsensus.storyConfidence * 0.55 +
          avgConsensusConf * 0.25 +
          (100 - cluster.storyConsensus.disputeScore) * 0.2,
      )
    : clampScore(avgConsensusConf * 0.7 + finalArticleReliability * 0.3);

  const finalUncertaintyLevel = cluster
    ? clampScore(
        cluster.storyConsensus.uncertaintyScore * 0.45 +
          avgHallucination * 0.25 +
          avgContradiction * 0.15 +
          unclearShare * 100 * 0.15,
      )
    : clampScore(
        avgHallucination * 0.35 +
          avgContradiction * 0.3 +
          unclearShare * 100 * 0.35,
      );

  enginesRun.push("final_intelligence");

  const intelligenceSummary =
    `Epistemic synthesis across ${claimSignals.length} claim(s): article reliability ${finalArticleReliability}/100, ` +
    `story confidence ${finalStoryConfidence ?? "n/a"}/100, uncertainty ${finalUncertaintyLevel}/100. ` +
    `Verdicts remain supported | disputed | unclear | insufficient_evidence only.`;

  return {
    finalArticleReliability,
    finalSourceReliability,
    finalAuthorReliability,
    finalStoryConfidence,
    finalUncertaintyLevel,
    disclaimer: FINAL_INTELLIGENCE_DISCLAIMER,
    intelligenceSummary,
    article,
    cluster,
    claimSignals,
    enginesRun: [...new Set(enginesRun)],
    computedAt: new Date().toISOString(),
  };
}
