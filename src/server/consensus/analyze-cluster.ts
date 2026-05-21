import type { NewsArticle, StoryCluster } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import { runVerificationPipeline } from "../analysis/verification";
import { extractDomain } from "../news/utils/url";
import { stableArticleId } from "../news/utils/text";
import { buildStoryConsensus } from "./build-consensus";
import type { AnalyzedArticleBundle, StoryConsensusInput } from "./types";

const MAX_ARTICLES_PER_CONSENSUS = 12;

function articleToPipeline(article: NewsArticle): PipelineArticleContext {
  const text =
    article.fullText ??
    article.description ??
    article.ingestMetadata?.summary ??
    article.title;
  return {
    submissionId: article.id || stableArticleId(article.url),
    title: article.title,
    url: article.url,
    summary: article.description?.slice(0, 500) ?? article.title,
    analysisText: text.slice(0, 50_000),
    author: article.author,
    publishedAt: article.publishedAt,
    language: article.language ?? "en",
    contentRights: article.ingestMetadata?.contentPolicy === "feed_summary_only"
      ? "metadata_only"
      : "licensed_excerpt",
    rightsNote: article.ingestMetadata?.rightsNote ?? "Ingested feed summary for consensus analysis.",
  };
}

function analyzeArticle(article: NewsArticle): AnalyzedArticleBundle {
  const ctx = articleToPipeline(article);
  const { report, results } = runVerificationPipeline(ctx);
  const domain = article.sourceDomain ?? extractDomain(article.url);
  const sourceId = article.sourceId ?? domain.replace(/\./g, "_");
  return {
    articleId: ctx.submissionId,
    url: article.url,
    title: article.title,
    sourceId,
    sourceName: article.sourceName ?? domain,
    sourceDomain: domain,
    publishedAt: article.publishedAt,
    analysisText: ctx.analysisText,
    report,
    results,
  };
}

export function runStoryConsensusForCluster(
  cluster: StoryCluster,
  articles: NewsArticle[],
): ReturnType<typeof buildStoryConsensus> {
  const members = articles
    .filter((a) => a.clusterId === cluster.id || cluster.articleIds?.includes(a.id))
    .slice(0, MAX_ARTICLES_PER_CONSENSUS);

  const clusterArticles =
    members.length > 0
      ? members
      : articles.slice(0, MAX_ARTICLES_PER_CONSENSUS);

  if (clusterArticles.length < 2) {
    throw new Error("Story consensus requires at least 2 articles covering the same event.");
  }

  const analyzed = clusterArticles.map(analyzeArticle);
  const input: StoryConsensusInput = {
    clusterId: cluster.id,
    title: cluster.title,
    summary: cluster.summary,
    articles: analyzed,
  };
  return buildStoryConsensus(input);
}

export function runStoryConsensusFromArticles(
  clusterId: string,
  title: string,
  articles: NewsArticle[],
): ReturnType<typeof buildStoryConsensus> {
  if (articles.length < 2) {
    throw new Error("Story consensus requires at least 2 articles.");
  }
  const analyzed = articles.slice(0, MAX_ARTICLES_PER_CONSENSUS).map(analyzeArticle);
  return buildStoryConsensus({
    clusterId,
    title,
    summary: `Multi-source comparison of ${articles.length} articles.`,
    articles: analyzed,
  });
}
