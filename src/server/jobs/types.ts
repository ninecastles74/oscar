/** Scheduled reliability job identifiers. */
export type ReliabilityJobId =
  | "recalculate_organization_scores"
  | "recalculate_author_scores"
  | "update_historical_trends"
  | "update_topic_reliability"
  | "recalculate_confidence_evidence";

export interface ScheduledJobError {
  entityId: string;
  message: string;
}

export interface ScheduledJobResult {
  jobId: ReliabilityJobId;
  startedAt: string;
  completedAt: string;
  success: boolean;
  processed: number;
  updated: number;
  skipped: number;
  errors: ScheduledJobError[];
  details?: Record<string, string | number | boolean | null>;
}

export interface ScheduledJobsRunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  trigger: "cron" | "manual" | "api";
  cronExpression?: string;
  results: ScheduledJobResult[];
}
