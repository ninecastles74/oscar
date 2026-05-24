import type { ArticleSource } from "@/types/news-platform";
import { MAJOR_US_WORLD_SOURCES } from "../news/major-publishers";

/** Approved outlets — major US/world organizations always tracked for comparison. */
export const APPROVED_SOURCES: ArticleSource[] = MAJOR_US_WORLD_SOURCES;

export function approvedSourceById(id: string): ArticleSource | undefined {
  return APPROVED_SOURCES.find((s) => s.id === id);
}
