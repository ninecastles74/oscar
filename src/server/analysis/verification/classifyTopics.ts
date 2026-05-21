import type { ClassifiedClaim } from "./types";
import type { PipelineArticleContext } from "../types";
import { classifyTopicsSync } from "../topics/classify-topics";
import type { ClassifyTopicsResult } from "../topics/types";

/**
 * 2b. classifyTopics — multi-topic labels with confidence for article + claims.
 */
export function classifyTopicsForPipeline(
  article: PipelineArticleContext,
  claims: ClassifiedClaim[],
): ClassifyTopicsResult {
  return classifyTopicsSync({
    title: article.title,
    summary: article.summary,
    body: article.analysisText,
    claims: claims.map((c) => ({ id: c.id, text: c.text })),
  });
}
