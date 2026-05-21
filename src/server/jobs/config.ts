import type { ReliabilityJobId } from "./types";

export interface JobScheduleConfig {
  jobId: ReliabilityJobId;
  /** Cron expression (Cloudflare Workers cron syntax). */
  cron: string;
  description: string;
  enabled: boolean;
}

/** Default schedules — override via RELIABILITY_JOB_CRONS_JSON env if needed. */
export const DEFAULT_JOB_SCHEDULES: JobScheduleConfig[] = [
  {
    jobId: "recalculate_confidence_evidence",
    cron: "*/30 * * * *",
    description: "Recalculate scores when new evidence is queued (every 30 min)",
    enabled: true,
  },
  {
    jobId: "update_historical_trends",
    cron: "0 */4 * * *",
    description: "Refresh historical trend snapshots (every 4 hours)",
    enabled: true,
  },
  {
    jobId: "recalculate_organization_scores",
    cron: "0 2 * * *",
    description: "Roll up organization reliability (daily 02:00 UTC)",
    enabled: true,
  },
  {
    jobId: "recalculate_author_scores",
    cron: "0 3 * * *",
    description: "Roll up author reliability (daily 03:00 UTC)",
    enabled: true,
  },
  {
    jobId: "update_topic_reliability",
    cron: "0 4 * * *",
    description: "Update topic-specific reliability aggregates (daily 04:00 UTC)",
    enabled: true,
  },
];

export function getJobSchedules(): JobScheduleConfig[] {
  const raw = process.env.RELIABILITY_JOB_CRONS_JSON;
  if (!raw?.trim()) return DEFAULT_JOB_SCHEDULES;
  try {
    const parsed = JSON.parse(raw) as JobScheduleConfig[];
    return Array.isArray(parsed) ? parsed : DEFAULT_JOB_SCHEDULES;
  } catch {
    return DEFAULT_JOB_SCHEDULES;
  }
}

export function jobsForCronExpression(cron: string): ReliabilityJobId[] {
  return getJobSchedules()
    .filter((s) => s.enabled && s.cron === cron)
    .map((s) => s.jobId);
}

export function isReliabilityJobsEnabled(): boolean {
  const flag = process.env.RELIABILITY_JOBS_ENABLED;
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim() || undefined;
}
