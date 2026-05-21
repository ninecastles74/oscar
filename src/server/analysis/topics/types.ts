import type { TopicClassification } from "@/types/news-platform";

export interface ClassifyTopicsClaimInput {
  id: string;
  text: string;
}

export interface ClassifyTopicsInput {
  title: string;
  summary?: string;
  body: string;
  claims: ClassifyTopicsClaimInput[];
}

export interface ClassifyTopicsResult {
  article: TopicClassification;
  claimClassifications: Record<string, TopicClassification>;
}
