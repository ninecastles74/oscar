import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ExplainableEntityType } from "@/types/news-platform";
import { getManualAnalysisResult } from "../../analysis/manual";
import { getReliabilityBundleByArticleId } from "../engine";
import { getVerificationSnapshot } from "../snapshots";
import { buildScoreExplainability, buildFullExplainabilityBundle } from "./build-explainability";

const explainSchema = z.object({
  entityType: z.enum(["article", "source", "author"]),
  entityId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  articleId: z.string().min(1).optional(),
});

const bundleSchema = z.object({
  requestId: z.string().min(1).optional(),
  articleId: z.string().min(1).optional(),
});

function resolveAnalysisContext(requestId?: string, articleId?: string) {
  if (requestId) {
    const manual = getManualAnalysisResult(requestId);
    if (manual) {
      return {
        report: manual.report,
        bundle: manual.reliability,
        results: getVerificationSnapshot(requestId)?.results,
      };
    }
    const snap = getVerificationSnapshot(requestId);
    if (snap) {
      const bundle = getReliabilityBundleByArticleId(snap.article.submissionId);
      if (bundle) return { report: snap.report, bundle, results: snap.results };
    }
  }
  if (articleId) {
    const bundle = getReliabilityBundleByArticleId(articleId);
    if (!bundle) return null;
    const snap = bundle.article.reportId
      ? getVerificationSnapshot(bundle.article.reportId)
      : null;
    return {
      report: snap?.report ?? null,
      bundle,
      results: snap?.results,
    };
  }
  return null;
}

/** Explainability for a single score (article, source, or author). */
export const getScoreExplainability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => explainSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = resolveAnalysisContext(data.requestId, data.articleId ?? data.entityId);
    if (!ctx?.report) {
      return { error: { code: "NOT_FOUND", message: "No analysis context for explainability" } };
    }

    try {
      const explainability = buildScoreExplainability({
        entityType: data.entityType as ExplainableEntityType,
        entityId: data.entityId,
        report: ctx.report,
        bundle: ctx.bundle,
        results: ctx.results,
      });
      return explainability;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Explainability unavailable";
      return { error: { code: "NOT_FOUND", message } };
    }
  });

/** Full explainability bundle for an analysis (article + source + author). */
export const getAnalysisExplainability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => bundleSchema.parse(data))
  .handler(async ({ data }) => {
    const ctx = resolveAnalysisContext(data.requestId, data.articleId);
    if (!ctx?.report) {
      return { error: { code: "NOT_FOUND", message: "No analysis context for explainability" } };
    }
    return buildFullExplainabilityBundle(ctx.report, ctx.bundle, ctx.results);
  });
