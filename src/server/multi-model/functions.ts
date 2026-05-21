import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PipelineArticleContext } from "../analysis/types";
import { runVerificationPipeline } from "../analysis/verification";
import { enrichVerificationWithMultiModel } from "./orchestrator";

const inputSchema = z.object({
  text: z.string().min(80),
  title: z.string().optional(),
});

export const runMultiModelClaimVerification = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const article: PipelineArticleContext = {
      submissionId: `mm_${Date.now().toString(36)}`,
      title: data.title ?? "Multi-model verification",
      url: "manual://multi-model",
      summary: data.text.slice(0, 500),
      analysisText: data.text.slice(0, 50_000),
      language: "en",
      contentRights: "user_provided",
      rightsNote: "User text for multi-model verification.",
    };

    const bundle = runVerificationPipeline(article);
    const enriched = await enrichVerificationWithMultiModel(bundle);
    return {
      report: enriched.report,
      multiModel: enriched.report.multiModelVerification,
      stages: enriched.stages,
    };
  });
