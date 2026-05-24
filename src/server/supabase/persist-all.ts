import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import type { PersistScoresContext } from "../reliability/engine";
import type { RecalculateScoresResult } from "../reliability/types/scoring.types";
import { isSupabaseConfigured } from "./config";
import { persistAnalysisToSupabase } from "./persist-analysis";
import { persistScoresToSupabase } from "./persist-scores";

/**
 * Persist analysis then scores in order so article rows exist before article_scores inserts.
 */
export async function persistVerificationToSupabase(
  report: AnalysisReport,
  results: VerificationPipelineResults,
  article: PipelineArticleContext,
  scores?: { result: RecalculateScoresResult; ctx: PersistScoresContext },
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await persistAnalysisToSupabase(report, results, article);

  if (scores) {
    await persistScoresToSupabase(scores.result, scores.ctx);
  }
}
