/** Who triggered analysis — controls expensive AI steps (multi-model, etc.). */
export type AnalysisTrigger = "user" | "scheduled";

export function shouldUseMultiModel(trigger: AnalysisTrigger): boolean {
  if (trigger === "scheduled") {
    return process.env.SCHEDULED_USE_MULTI_MODEL !== "false";
  }
  return true;
}

export function isScheduledNewsEnabled(): boolean {
  const flag = process.env.SCHEDULED_NEWS_ENABLED;
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function scheduledIngestCron(): string {
  return process.env.SCHEDULED_NEWS_CRON?.trim() || "0 */8 * * *";
}

export function scheduledMaxClusters(): number {
  const n = Number.parseInt(process.env.SCHEDULED_ANALYSIS_MAX_CLUSTERS ?? "12", 10);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

export function scheduledMaxArticlesPerCluster(): number {
  const n = Number.parseInt(process.env.SCHEDULED_ANALYSIS_MAX_ARTICLES_PER_CLUSTER ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}
