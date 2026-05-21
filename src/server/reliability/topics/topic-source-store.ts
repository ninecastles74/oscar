import type { ContentTopic, TopicSourceReliability } from "@/types/news-platform";

/** organizationId → topic → history */
const byOrgAndTopic = new Map<string, Map<ContentTopic, TopicSourceReliability[]>>();

export function saveTopicSourceReliability(score: TopicSourceReliability): void {
  let topicMap = byOrgAndTopic.get(score.organizationId);
  if (!topicMap) {
    topicMap = new Map();
    byOrgAndTopic.set(score.organizationId, topicMap);
  }
  const list = topicMap.get(score.topic) ?? [];
  list.push(score);
  topicMap.set(score.topic, list);
}

export function getTopicSourceReliabilityHistory(
  organizationId: string,
  topic: ContentTopic,
): TopicSourceReliability[] {
  return byOrgAndTopic.get(organizationId)?.get(topic) ?? [];
}

export function getLatestTopicSourceReliability(
  organizationId: string,
  topic: ContentTopic,
): TopicSourceReliability | undefined {
  const list = getTopicSourceReliabilityHistory(organizationId, topic);
  return list[list.length - 1];
}

export function getAllTopicSourceReliabilityForOrg(
  organizationId: string,
): TopicSourceReliability[] {
  const topicMap = byOrgAndTopic.get(organizationId);
  if (!topicMap) return [];
  const latest: TopicSourceReliability[] = [];
  for (const scores of topicMap.values()) {
    const last = scores[scores.length - 1];
    if (last) latest.push(last);
  }
  return latest.sort((a, b) => b.overallScore - a.overallScore);
}

export function listOrganizationIdsWithTopicScores(): string[] {
  return [...byOrgAndTopic.keys()];
}

export function listTopicsForOrganization(organizationId: string): ContentTopic[] {
  return [...(byOrgAndTopic.get(organizationId)?.keys() ?? [])];
}
