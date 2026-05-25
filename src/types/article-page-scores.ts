export interface ArticleStoryScores {
  consensusScore: number;
  disputeScore: number;
  uncertaintyScore: number;
  storyConfidence: number;
}

/** Lean, JSON-safe scores for feed article pages (persisted in KV). */
export interface ArticlePageScores {
  articleId: string;
  weightedArticleScore: number;
  verificationConfidence: number;
  story: ArticleStoryScores | null;
  categories: Array<{
    id: string;
    label: string;
    score: number;
    weightPercent: number;
    description?: string;
    formulaSummary?: string;
  }>;
}
