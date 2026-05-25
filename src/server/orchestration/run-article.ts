import { applyClaimConsensusToReport } from "../consensus-engine";
import { enrichVerificationWithMultiModel } from "../multi-model";
import { runVerificationPipeline } from "../analysis/verification";
import { computeAndStoreReliabilityScores } from "../reliability/engine";
import { buildTransparencyExplainabilityBundle } from "../transparency-explainability/build-bundle";
import type { ArticleOrchestrationInput, ArticleOrchestrationReport } from "./types";

/**
 * Article analysis orchestration — verification → multi-model → reliability →
 * claim consensus → transparency bundle.
 */
export async function runArticleAnalysisOrchestration(
  input: ArticleOrchestrationInput,
): Promise<ArticleOrchestrationReport> {
  const stages: ArticleOrchestrationReport["stagesCompleted"] = ["verification"];
  const trigger = input.trigger ?? "user";

  let bundle = await runVerificationPipeline(input.article);
  if (!input.skipMultiModel) {
    bundle = await enrichVerificationWithMultiModel(bundle, trigger);
    stages.push("multi_model");
  }

  const { report, results } = bundle;
  stages.push("reliability");

  const reliability = computeAndStoreReliabilityScores({
    report,
    results,
    article: input.article,
    reportId: input.reportId ?? input.article.submissionId,
    authorDisplayName: input.authorDisplayName,
  });

  const reportWithConsensus = applyClaimConsensusToReport(report, reliability);
  stages.push("claim_consensus");

  const transparency = buildTransparencyExplainabilityBundle({
    report: reportWithConsensus,
    bundle: reliability,
    results,
  });
  stages.push("transparency");

  return {
    articleId: input.article.submissionId,
    report: reportWithConsensus,
    results,
    reliability,
    transparency,
    stagesCompleted: stages,
    computedAt: new Date().toISOString(),
  };
}
