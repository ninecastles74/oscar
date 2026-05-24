import { ingestNews } from "../../news/ingest";
import {
  getTop100Clusters,
  mergeIngestIntoFeed,
  setLastAnalysisAt,
  getFeedMeta,
  getClusterArticlesFromStore,
} from "../../news/feed-store";
import { runHeavyweightClusterAnalysis } from "../../consensus/analyze-cluster-heavyweight";

export interface ScheduledNewsRunResult {
  success: boolean;
  ingestedAt: string;
  clustersRanked: number;
  clustersAnalyzed: number;
  newArticles: number;
  articlesAnalyzed: number;
  errors: string[];
}

/**
 * Scheduled ingest + incremental heavyweight analysis (multi-model) for NEW articles only.
 * Top 100 feed is time-ranked; older clusters drop off the visible feed when capped at 100.
 */
export async function runScheduledNewsPipeline(): Promise<ScheduledNewsRunResult> {
  const errors: string[] = [];
  const ingestedAt = new Date().toISOString();

  try {
    const ingest = await ingestNews({
      maxArticlesPerProvider: Number.parseInt(
        process.env.SCHEDULED_INGEST_MAX_PER_PROVIDER ?? "50",
        10,
      ),
      topN: 100,
    });

    const merge = mergeIngestIntoFeed(ingest);
    const newArticleIds = merge.newArticleIds;

    const top100 = getTop100Clusters();
    const top100Ids = new Set(top100.map((c) => c.id));

    const clustersToProcess = merge.affectedClusterIds.filter((id) => top100Ids.has(id));
    let clustersAnalyzed = 0;
    let articlesAnalyzed = 0;

    for (const clusterId of clustersToProcess) {
      const cluster = top100.find((c) => c.id === clusterId);
      if (!cluster) continue;

      const articles = getClusterArticlesFromStore(clusterId);
      const newInCluster = newArticleIds.filter((aid) =>
        articles.some((a) => (a.id || a.url) === aid),
      );

      if (newInCluster.length === 0) continue;

      try {
        await runHeavyweightClusterAnalysis(cluster, articles, {
          onlyAnalyzeArticleIds: newInCluster,
        });
        clustersAnalyzed += 1;
        articlesAnalyzed += newInCluster.length;
      } catch (err) {
        errors.push(
          `cluster ${clusterId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    setLastAnalysisAt(new Date().toISOString());

    return {
      success: errors.length === 0,
      ingestedAt,
      clustersRanked: merge.top100.length,
      clustersAnalyzed,
      newArticles: newArticleIds.length,
      articlesAnalyzed,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      ingestedAt,
      clustersRanked: getFeedMeta().top100Count,
      clustersAnalyzed: 0,
      newArticles: 0,
      articlesAnalyzed: 0,
      errors,
    };
  }
}
