import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCronSecret, getJobSchedules, isReliabilityJobsEnabled } from "./config";
import { getAllLastJobResults, getLastFullRun, getLastJobResult } from "./job-run-store";
import { ALL_JOB_IDS } from "./registry";
import { runAllReliabilityJobs, runReliabilityJob, runReliabilityJobs } from "./runner";
import type { ReliabilityJobId } from "./types";
import { enqueueEvidenceRecalculation, getEvidenceRecalculationQueueSize } from "../reliability/evidence-queue";

const jobIdSchema = z.enum([
  "recalculate_organization_scores",
  "recalculate_author_scores",
  "update_historical_trends",
  "update_topic_reliability",
  "recalculate_confidence_evidence",
]);

const runJobsSchema = z
  .object({
    jobs: z.array(jobIdSchema).optional(),
    cronSecret: z.string().optional(),
  })
  .optional();

const markEvidenceSchema = z.object({
  reportId: z.string().min(1),
});

function assertCronAuthorized(secret?: string): void {
  const expected = getCronSecret();
  if (!expected) return;
  if (secret !== expected) {
    throw new Error("Unauthorized: invalid CRON_SECRET");
  }
}

/** Run one or all reliability scheduled jobs (manual or cron-triggered). */
export const runScheduledReliabilityJobs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => runJobsSchema.parse(data))
  .handler(async ({ data }) => {
    assertCronAuthorized(data?.cronSecret);
    if (!isReliabilityJobsEnabled()) {
      return { error: { code: "DISABLED", message: "Reliability jobs are disabled" } };
    }
    const jobs = (data?.jobs ?? ALL_JOB_IDS) as ReliabilityJobId[];
    return runReliabilityJobs(jobs, data?.cronSecret ? "cron" : "api");
  });

/** Run a single reliability job by id. */
export const runReliabilityScheduledJob = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ jobId: jobIdSchema, cronSecret: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    assertCronAuthorized(data.cronSecret);
    if (!isReliabilityJobsEnabled()) {
      return { error: { code: "DISABLED", message: "Reliability jobs are disabled" } };
    }
    return runReliabilityJob(data.jobId);
  });

/** Queue a report for confidence/score recalculation when new evidence arrives. */
export const markEvidenceUpdated = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => markEvidenceSchema.parse(data))
  .handler(async ({ data }) => {
    enqueueEvidenceRecalculation(data.reportId);
    return {
      reportId: data.reportId,
      queued: true,
      queueSize: getEvidenceRecalculationQueueSize(),
    };
  });

/** Job schedules, last run results, and queue status. */
export const getScheduledJobsStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    enabled: isReliabilityJobsEnabled(),
    schedules: getJobSchedules(),
    lastRun: getLastFullRun(),
    lastJobResults: getAllLastJobResults(),
    evidenceQueueSize: getEvidenceRecalculationQueueSize(),
    jobIds: ALL_JOB_IDS,
  };
});

/** Fetch last result for a specific job. */
export const getScheduledJobResult = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ jobId: jobIdSchema }).parse(data))
  .handler(async ({ data }) => {
    const result = getLastJobResult(data.jobId);
    if (!result) {
      return { error: { code: "NOT_FOUND", message: "Job has not run yet" } };
    }
    return result;
  });

export { runAllReliabilityJobs };
