import { buildStoryConsensus } from "@/server/consensus/build-consensus";
import { buildStoryConsensusIntelligence } from "@/server/consensus/story-intelligence";
import {
  buildArticleBundle,
  runStoryConsensusForCluster,
  runStoryConsensusFromArticles,
} from "@/server/consensus/analyze-cluster";
import {
  getStoryConsensus,
  saveStoryConsensus,
} from "@/server/consensus/store";
import type {
  StoryConsensusFromArticlesInput,
  StoryConsensusFromClusterInput,
  StoryConsensusInput,
  StoryConsensusIntelligenceJson,
  StoryConsensusJson,
} from "./types";

/**
 * Story Consensus Engine (service facade)
 *
 * Compares multiple articles on the same event: overlapping claims, disputes,
 * omitted context, framing differences, and source agreement. Does not declare
 * objective truth — scores reflect cross-source epistemic alignment.
 */
export function runStoryConsensus(input: StoryConsensusInput): StoryConsensusJson {
  return buildStoryConsensus(input);
}

/**
 * Story Consensus Intelligence Layer — full event comparison with evidence density,
 * evolving narratives, missing evidence, and emerging contradictions.
 */
export function runStoryConsensusIntelligence(
  input: StoryConsensusInput,
): StoryConsensusIntelligenceJson {
  return buildStoryConsensusIntelligence(input);
}

export function runStoryConsensusForClusterInput(
  input: StoryConsensusFromClusterInput,
): StoryConsensusJson {
  return runStoryConsensusForCluster(input.cluster, input.articles);
}

export function runStoryConsensusFromFeedArticles(
  input: StoryConsensusFromArticlesInput,
): StoryConsensusJson {
  return runStoryConsensusFromArticles(input.clusterId, input.title, input.articles);
}

/** Build consensus from pre-analyzed article bundles (no verification pipeline). */
export function runStoryConsensusFromBundles(input: StoryConsensusInput): StoryConsensusJson {
  return buildStoryConsensus(input);
}

/** Analyze a single feed article and run consensus (single-source path). */
export function runStoryConsensusForArticle(
  clusterId: string,
  title: string,
  article: import("@/types/news-platform").NewsArticle,
): StoryConsensusJson {
  return runStoryConsensusFromArticles(clusterId, title, [article]);
}

export function buildStoryConsensusArticleBundle(
  article: import("@/types/news-platform").NewsArticle,
) {
  return buildArticleBundle(article);
}

export function persistStoryConsensus(report: StoryConsensusJson): void {
  saveStoryConsensus(report);
}

export function loadStoryConsensus(clusterId: string): StoryConsensusJson | undefined {
  return getStoryConsensus(clusterId);
}

export function runAndPersistStoryConsensus(
  input: StoryConsensusInput,
): StoryConsensusJson {
  const report = buildStoryConsensus(input);
  saveStoryConsensus(report);
  return report;
}
