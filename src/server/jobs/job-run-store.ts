import type { ReliabilityJobId, ScheduledJobResult, ScheduledJobsRunSummary } from "./types";

const lastJobResults = new Map<ReliabilityJobId, ScheduledJobResult>();
let lastFullRun: ScheduledJobsRunSummary | null = null;

export function recordJobResult(result: ScheduledJobResult): void {
  lastJobResults.set(result.jobId, result);
}

export function recordFullRun(summary: ScheduledJobsRunSummary): void {
  lastFullRun = summary;
  for (const r of summary.results) {
    lastJobResults.set(r.jobId, r);
  }
}

export function getLastJobResult(jobId: ReliabilityJobId): ScheduledJobResult | undefined {
  return lastJobResults.get(jobId);
}

export function getLastFullRun(): ScheduledJobsRunSummary | null {
  return lastFullRun;
}

export function getAllLastJobResults(): ScheduledJobResult[] {
  return [...lastJobResults.values()];
}
