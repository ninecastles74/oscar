import {
  buildFinalIntelligenceReport,
  runArticleAnalysisOrchestration,
  runClusterAnalysisOrchestration,
  runScheduledFeedOrchestration,
} from "@/server/orchestration";
import type {
  ArticleOrchestrationInput,
  ArticleOrchestrationJson,
  ClusterOrchestrationInput,
  ClusterOrchestrationJson,
  FinalIntelligenceInput,
  FinalIntelligenceJson,
  ScheduledOrchestrationJson,
} from "./types";

/**
 * Analysis Orchestration Layer — coordinates verification, multi-model review,
 * reliability scoring, claim consensus, story consensus, and transparency outputs.
 */
export async function runArticleOrchestration(
  input: ArticleOrchestrationInput,
): Promise<ArticleOrchestrationJson> {
  return runArticleAnalysisOrchestration(input);
}

export async function runClusterOrchestration(
  input: ClusterOrchestrationInput,
): Promise<ClusterOrchestrationJson> {
  return runClusterAnalysisOrchestration(input);
}

export async function runScheduledOrchestration(): Promise<ScheduledOrchestrationJson> {
  return runScheduledFeedOrchestration();
}

/**
 * Final Intelligence Orchestration Layer — runs all engines and returns
 * consolidated epistemic scores (never absolute truth claims).
 */
export async function runFinalIntelligenceOrchestration(
  input: FinalIntelligenceInput,
): Promise<FinalIntelligenceJson> {
  return buildFinalIntelligenceReport(input);
}
