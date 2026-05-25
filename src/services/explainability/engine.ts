import { getManualAnalysisResult } from "@/server/analysis/manual";
import type { VerificationPipelineResults } from "@/server/analysis/verification/types";
import type { AnalysisReport, ReliabilityScoreBundle } from "@/types/news-platform";
import { getReliabilityBundleByArticleId } from "@/server/reliability/engine";
import {
  buildFullExplainabilityBundle,
  buildScoreExplainability,
} from "@/server/reliability/explainability/build-explainability";
import { getVerificationSnapshot } from "@/server/reliability/snapshots";
import type {
  AnalysisExplainabilityBundleJson,
  ExplainabilityBundleInput,
  ExplainabilityInput,
  ExplainabilityLookupInput,
  ScoreExplainabilityJson,
} from "./types";

interface ResolvedAnalysisContext {
  report: AnalysisReport;
  bundle: ReliabilityScoreBundle;
  results?: VerificationPipelineResults;
}

function resolveAnalysisContext(
  requestId?: string,
  articleId?: string,
): ResolvedAnalysisContext | null {
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
      if (bundle) {
        return { report: snap.report, bundle, results: snap.results };
      }
    }
  }
  if (articleId) {
    const bundle = getReliabilityBundleByArticleId(articleId);
    if (!bundle) return null;
    const snap = bundle.article.reportId
      ? getVerificationSnapshot(bundle.article.reportId)
      : null;
    if (!snap?.report) return null;
    return {
      report: snap.report,
      bundle,
      results: snap.results,
    };
  }
  return null;
}

/**
 * Score Explainability Engine (service facade)
 *
 * Explains why reliability scores exist, how they were calculated, and which
 * evidence drove penalties — structured JSON only, not truth verdicts.
 */
export function runScoreExplainability(input: ExplainabilityInput): ScoreExplainabilityJson {
  return buildScoreExplainability(input);
}

export function runAnalysisExplainabilityBundle(
  input: ExplainabilityBundleInput,
): AnalysisExplainabilityBundleJson {
  return buildFullExplainabilityBundle(input.report, input.bundle, input.results);
}

export function explainScoreFromLookup(
  input: ExplainabilityLookupInput,
): ScoreExplainabilityJson | null {
  const ctx = resolveAnalysisContext(input.requestId, input.articleId ?? input.entityId);
  if (!ctx?.report) return null;
  return buildScoreExplainability({
    entityType: input.entityType,
    entityId: input.entityId,
    report: ctx.report,
    bundle: ctx.bundle,
    results: ctx.results,
  });
}

export function explainAnalysisFromLookup(
  input: Omit<ExplainabilityLookupInput, "entityType" | "entityId">,
): AnalysisExplainabilityBundleJson | null {
  const ctx = resolveAnalysisContext(input.requestId, input.articleId);
  if (!ctx?.report) return null;
  return buildFullExplainabilityBundle(ctx.report, ctx.bundle, ctx.results);
}
