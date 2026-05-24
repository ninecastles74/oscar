import type { Bias, Category, Verdict } from "@/types/news-platform";
import type { ClaimKind } from "../analysis/verification/types";

/** Map app bias to Postgres enum (Prisma @@map values). */
export function toDbBias(bias: Bias | string): string {
  const map: Record<string, string> = {
    "center-left": "center-left",
    center_left: "center-left",
    "center-right": "center-right",
    center_right: "center-right",
    left: "left",
    center: "center",
    right: "right",
    unknown: "unknown",
  };
  return map[bias] ?? "unknown";
}

export function toDbCategory(category: Category | string): string {
  return category as string;
}

export function toDbVerdict(verdict: Verdict): string {
  return verdict;
}

export function toDbClaimKind(kind: string): string {
  return kind;
}

export function toDbTrendDirection(dir: string | undefined): string | null {
  if (!dir) return null;
  return dir;
}

export function toDbContentPolicy(rights: string | undefined): string | null {
  const map: Record<string, string> = {
    user_provided: "user_provided",
    metadata_only: "metadata_only",
    licensed_excerpt: "licensed_excerpt",
    feed_summary_only: "feed_summary_only",
    licensed_full_text: "licensed_full_text",
  };
  return rights ? (map[rights] ?? null) : null;
}
