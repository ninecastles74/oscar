import { runScheduledNewsPipeline } from "../jobs/news/scheduled-pipeline";
import type { ScheduledOrchestrationReport } from "./types";

/** Scheduled feed orchestration — RSS ingest + incremental cluster analysis. */
export async function runScheduledFeedOrchestration(): Promise<ScheduledOrchestrationReport> {
  const result = await runScheduledNewsPipeline();
  return {
    ...result,
    stagesCompleted: ["ingest", "scheduled_feed", "verification", "multi_model", "story_consensus"],
  };
}
