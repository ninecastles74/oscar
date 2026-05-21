import type {
  ArticleReliabilityScore,
  AuthorReliabilityScore,
  Category,
  OrganizationReliabilityScore,
  ReliabilityScoreHistoryEntry,
  TopicReliabilityScore,
} from "@/types/news-platform";

const articleScores = new Map<string, ArticleReliabilityScore[]>();
const articleByReport = new Map<string, string>();
const orgScores = new Map<string, OrganizationReliabilityScore[]>();
const authorScores = new Map<string, AuthorReliabilityScore[]>();
const topicScores = new Map<string, TopicReliabilityScore[]>();
const history: ReliabilityScoreHistoryEntry[] = [];

export function appendHistory(entry: ReliabilityScoreHistoryEntry): void {
  history.push(entry);
  if (history.length > 5000) history.splice(0, history.length - 5000);
}

export function getHistory(
  entityType?: ReliabilityScoreHistoryEntry["entityType"],
  entityId?: string,
) {
  return history.filter(
    (h) => (!entityType || h.entityType === entityType) && (!entityId || h.entityId === entityId),
  );
}

export function saveArticleScore(score: ArticleReliabilityScore, reportId?: string): void {
  const list = articleScores.get(score.articleId) ?? [];
  list.push(score);
  articleScores.set(score.articleId, list);
  if (reportId) articleByReport.set(reportId, score.articleId);
}

export function getArticleScores(articleId: string): ArticleReliabilityScore[] {
  return articleScores.get(articleId) ?? [];
}

export function getArticleIdByReport(reportId: string): string | undefined {
  return articleByReport.get(reportId);
}

export function saveOrganizationScore(score: OrganizationReliabilityScore): void {
  const list = orgScores.get(score.organizationId) ?? [];
  list.push(score);
  orgScores.set(score.organizationId, list);
}

export function getOrganizationScores(orgId: string): OrganizationReliabilityScore[] {
  return orgScores.get(orgId) ?? [];
}

export function getLatestOrganization(orgId: string): OrganizationReliabilityScore | undefined {
  const list = orgScores.get(orgId);
  return list?.[list.length - 1];
}

export function saveAuthorScore(score: AuthorReliabilityScore): void {
  const list = authorScores.get(score.authorId) ?? [];
  list.push(score);
  authorScores.set(score.authorId, list);
}

export function getAuthorScores(authorId: string): AuthorReliabilityScore[] {
  return authorScores.get(authorId) ?? [];
}

export function getLatestAuthor(authorId: string): AuthorReliabilityScore | undefined {
  const list = authorScores.get(authorId);
  return list?.[list.length - 1];
}

export function saveTopicScore(topic: Category, score: TopicReliabilityScore): void {
  const list = topicScores.get(topic) ?? [];
  list.push(score);
  topicScores.set(topic, list);
}

export function getTopicScores(topic: Category): TopicReliabilityScore[] {
  return topicScores.get(topic) ?? [];
}

export function listAllArticleIds(): string[] {
  return [...articleScores.keys()];
}

export function listAllOrganizationIds(): string[] {
  const ids = new Set(orgScores.keys());
  for (const versions of articleScores.values()) {
    for (const v of versions) {
      if (v.organizationId) ids.add(v.organizationId);
    }
  }
  return [...ids];
}

export function listAllAuthorIds(): string[] {
  const ids = new Set(authorScores.keys());
  for (const versions of articleScores.values()) {
    for (const v of versions) {
      if (v.authorId) ids.add(v.authorId);
    }
  }
  return [...ids];
}

export function listAllTopics(): Category[] {
  return [...topicScores.keys()] as Category[];
}

/** Latest scored article for a publisher organization. */
export function getLatestArticleForOrganization(
  organizationId: string,
): ArticleReliabilityScore | undefined {
  let latest: ArticleReliabilityScore | undefined;
  for (const versions of articleScores.values()) {
    const match = versions.filter((a) => a.organizationId === organizationId);
    const last = match[match.length - 1];
    if (!last) continue;
    if (!latest || new Date(last.computedAt) > new Date(latest.computedAt)) {
      latest = last;
    }
  }
  return latest;
}

/** Latest scored article for an author. */
export function getLatestArticleForAuthor(authorId: string): ArticleReliabilityScore | undefined {
  let latest: ArticleReliabilityScore | undefined;
  for (const versions of articleScores.values()) {
    const match = versions.filter((a) => a.authorId === authorId);
    const last = match[match.length - 1];
    if (!last) continue;
    if (!latest || new Date(last.computedAt) > new Date(latest.computedAt)) {
      latest = last;
    }
  }
  return latest;
}

/** Most recent article score per topic (for topic rollup jobs). */
export function getLatestArticleForTopic(topic: Category): ArticleReliabilityScore | undefined {
  let latest: ArticleReliabilityScore | undefined;
  for (const versions of articleScores.values()) {
    const last = versions[versions.length - 1];
    if (!last || last.topic !== topic) continue;
    if (!latest || new Date(last.computedAt) > new Date(latest.computedAt)) {
      latest = last;
    }
  }
  return latest;
}

export const ALL_CATEGORIES: Category[] = [
  "Politics",
  "World",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Climate",
  "Markets",
  "Sports",
  "Entertainment",
  "General",
];
