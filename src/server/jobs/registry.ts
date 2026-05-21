import type { ReliabilityJobId, ScheduledJobResult } from "./types";
import { runRecalculateAuthorScoresJob } from "./reliability/recalculate-authors.job";
import { runRecalculateConfidenceEvidenceJob } from "./reliability/recalculate-confidence-evidence.job";
import { runRecalculateOrganizationScoresJob } from "./reliability/recalculate-organizations.job";
import { runUpdateHistoricalTrendsJob } from "./reliability/update-historical-trends.job";
import { runUpdateTopicReliabilityJob } from "./reliability/update-topic-reliability.job";

export type JobRunner = () => ScheduledJobResult;

export const JOB_RUNNERS: Record<ReliabilityJobId, JobRunner> = {
  recalculate_organization_scores: runRecalculateOrganizationScoresJob,
  recalculate_author_scores: runRecalculateAuthorScoresJob,
  update_historical_trends: runUpdateHistoricalTrendsJob,
  update_topic_reliability: runUpdateTopicReliabilityJob,
  recalculate_confidence_evidence: runRecalculateConfidenceEvidenceJob,
};

export const ALL_JOB_IDS = Object.keys(JOB_RUNNERS) as ReliabilityJobId[];
