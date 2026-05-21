import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  computeAndStoreReliabilityScores,
  getReliabilityBundleByArticleId,
  recalculateReliabilityScores,
} from "./engine";
import { getArticleIdByReport } from "./store";

const lookupSchema = z
  .object({
    articleId: z.string().optional(),
    reportId: z.string().optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((d) => d.articleId || d.reportId, {
    message: "Provide articleId or reportId",
  });

const reportIdSchema = z.object({ reportId: z.string().min(1) });

/** Fetch reliability JSON for an article or report. */
export const getReliabilityScores = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }) => {
    const articleId =
      data.articleId ?? (data.reportId ? getArticleIdByReport(data.reportId) : undefined);
    if (!articleId) {
      return { error: { code: "NOT_FOUND", message: "No reliability scores for this id" } };
    }
    const bundle = getReliabilityBundleByArticleId(articleId, data.version);
    if (!bundle) {
      return { error: { code: "NOT_FOUND", message: "No reliability scores for this id" } };
    }
    return bundle;
  });

/** Recompute scores when new verification evidence is available (uses stored snapshot). */
export const recalculateReliability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reportIdSchema.parse(data))
  .handler(async ({ data }) => {
    const bundle = recalculateReliabilityScores(data.reportId);
    if (!bundle) {
      return { error: { code: "NOT_FOUND", message: "No verification snapshot for reportId" } };
    }
    return bundle;
  });

/** Queue async recalculation after new evidence is ingested (processed by scheduled job). */
export { markEvidenceUpdated } from "../jobs/functions";
