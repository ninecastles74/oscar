import { isReliabilityJobsEnabled, jobsForCronExpression } from "./config";
import { recordFullRun, recordJobResult } from "./job-run-store";
import { ALL_JOB_IDS, JOB_RUNNERS } from "./registry";
import type { ReliabilityJobId, ScheduledJobResult, ScheduledJobsRunSummary } from "./types";

function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function runReliabilityJob(jobId: ReliabilityJobId): ScheduledJobResult {
  if (!isReliabilityJobsEnabled()) {
    const now = new Date().toISOString();
    return {
      jobId,
      startedAt: now,
      completedAt: now,
      success: false,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [{ entityId: jobId, message: "Reliability jobs disabled (RELIABILITY_JOBS_ENABLED=false)" }],
    };
  }

  const runner = JOB_RUNNERS[jobId];
  if (!runner) {
    const now = new Date().toISOString();
    return {
      jobId,
      startedAt: now,
      completedAt: now,
      success: false,
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [{ entityId: jobId, message: "Unknown job id" }],
    };
  }

  const result = runner();
  recordJobResult(result);
  return result;
}

export function runReliabilityJobs(
  jobIds: ReliabilityJobId[],
  trigger: ScheduledJobsRunSummary["trigger"] = "manual",
  cronExpression?: string,
): ScheduledJobsRunSummary {
  const startedAt = new Date().toISOString();
  const results: ScheduledJobResult[] = [];

  for (const jobId of jobIds) {
    results.push(runReliabilityJob(jobId));
  }

  const summary: ScheduledJobsRunSummary = {
    runId: newRunId(),
    startedAt,
    completedAt: new Date().toISOString(),
    trigger,
    cronExpression,
    results,
  };

  recordFullRun(summary);
  return summary;
}

export function runAllReliabilityJobs(
  trigger: ScheduledJobsRunSummary["trigger"] = "manual",
): ScheduledJobsRunSummary {
  return runReliabilityJobs(ALL_JOB_IDS, trigger);
}

/** Invoked by Cloudflare Workers cron — runs jobs mapped to the cron expression. */
export function runCronScheduledJobs(cronExpression: string): ScheduledJobsRunSummary {
  const jobIds = jobsForCronExpression(cronExpression);
  if (jobIds.length === 0) {
    return runAllReliabilityJobs("cron");
  }
  return runReliabilityJobs(jobIds, "cron", cronExpression);
}
