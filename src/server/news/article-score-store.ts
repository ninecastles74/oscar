import type { ArticlePageScores } from "@/types/article-page-scores";

const scoresByArticleId = new Map<string, ArticlePageScores>();

export function saveArticlePageScores(scores: ArticlePageScores): void {
  scoresByArticleId.set(scores.articleId, scores);
}

export function getArticlePageScores(articleId: string): ArticlePageScores | undefined {
  return scoresByArticleId.get(articleId);
}

export function listArticlePageScores(): ArticlePageScores[] {
  return [...scoresByArticleId.values()];
}

export function hydrateArticlePageScores(entries: ArticlePageScores[]): void {
  for (const entry of entries) {
    if (entry?.articleId) scoresByArticleId.set(entry.articleId, entry);
  }
}

export function mergeStoryIntoArticlePageScores(
  story: ArticlePageScores["story"],
  articleIds: string[],
): void {
  if (!story) return;
  for (const id of articleIds) {
    const existing = scoresByArticleId.get(id);
    if (!existing) continue;
    scoresByArticleId.set(id, { ...existing, story });
  }
}
