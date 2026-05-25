import type {
  ArticleOrchestrationInput,
  ArticleOrchestrationReport,
  ClusterOrchestrationInput,
  ClusterOrchestrationReport,
  OrchestrationStage,
  ScheduledOrchestrationReport,
} from "@/server/orchestration";

export type {
  ArticleOrchestrationInput,
  ArticleOrchestrationReport,
  ClusterOrchestrationInput,
  ClusterOrchestrationReport,
  ScheduledOrchestrationReport,
  OrchestrationStage,
};

export type ArticleOrchestrationJson = ArticleOrchestrationReport;
export type ClusterOrchestrationJson = ClusterOrchestrationReport;
export type ScheduledOrchestrationJson = ScheduledOrchestrationReport;

import type {
  FinalIntelligenceInput,
  FinalIntelligenceReport,
  FinalClaimSignalSummary,
} from "@/server/orchestration/final-intelligence-types";

export type { FinalIntelligenceInput, FinalIntelligenceReport, FinalClaimSignalSummary };
export type FinalIntelligenceJson = FinalIntelligenceReport;
