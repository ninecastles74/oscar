import type { Category, ContentTopic } from "@/types/news-platform";

/** Map AI ContentTopic to legacy Category for existing reliability tables. */
export function contentTopicToLegacyCategory(topic: ContentTopic): Category {
  const map: Record<ContentTopic, Category> = {
    Politics: "Politics",
    Finance: "Markets",
    Science: "Science",
    Health: "Health",
    Technology: "Technology",
    International: "World",
    Crime: "General",
    Entertainment: "Entertainment",
    Sports: "Sports",
  };
  return map[topic] ?? "General";
}
