import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PipelineArticleContext } from "../analysis/types";
import { enrichVerificationWithMultiModel } from "../multi-model";
import { runVerificationPipeline } from "../analysis/verification";
import { computeAndStoreReliabilityScores } from "../reliability/engine";
import { buildClaimConsensusBatch } from "./build-consensus";

const inputSchema = z.object({
  text: z.string().min(80),
  title: z.string().optional(),
});

/** Run full pipeline + multi-model + claim consensus engine. */
export const runClaimConsensusEngine = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const article: PipelineArticleContext = {
      submissionId: `cons_${Date.now().toString(36)}`,
      title: data.title ?? "Consensus analysis",
      url: "manual://consensus",
      summary: data.text.slice(0, 500),
      analysisText: data.text.slice(0, 50_000),
      language: "en",
      contentRights: "user_provided",
      rightsNote: "User text for claim consensus engine.",
    };

    let bundle = await runVerificationPipeline(article);
    bundle = await enrichVerificationWithMultiModel(bundle);

    const reliability = computeAndStoreReliabilityScores({
      report: bundle.report,
      results: bundle.results,
      article,
      reportId: article.submissionId,
    });

    const consensus = buildClaimConsensusBatch(
      bundle.report.claims,
      article.submissionId,
      reliability,
    );

    return {
      consensus,
      report: bundle.report,
      reliability,
      stages: [...bundle.stages, "claimConsensus"],
    };
  });
