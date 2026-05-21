import type { StoryConsensusReport } from "@/types/news-platform";
import type { NewsArticle } from "@/types/news-platform";

const consensusByCluster = new Map<string, StoryConsensusReport>();
const articlesByCluster = new Map<string, NewsArticle[]>();

export function saveClusterArticles(clusterId: string, articles: NewsArticle[]): void {
  articlesByCluster.set(clusterId, articles);
}

export function getClusterArticles(clusterId: string): NewsArticle[] | undefined {
  return articlesByCluster.get(clusterId);
}

export function saveStoryConsensus(report: StoryConsensusReport): void {
  consensusByCluster.set(report.clusterId, report);
}

export function getStoryConsensus(clusterId: string): StoryConsensusReport | undefined {
  return consensusByCluster.get(clusterId);
}
