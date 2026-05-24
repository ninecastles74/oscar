import type { NewsArticle } from "@/types/news-platform";

/** Normalize provider image URLs for display (protocol-relative, trim, validate). */
export function normalizeImageUrl(url?: string | null): string | undefined {
  if (!url?.trim()) return undefined;
  let candidate = url.trim();
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  if (candidate.startsWith("/")) return undefined;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return undefined;
    }
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Pick the best cluster hero image from member articles (lead / reliability / any). */
export function pickClusterImageUrl(articles: NewsArticle[], lead?: NewsArticle): string | undefined {
  const ordered = lead
    ? [lead, ...articles.filter((a) => a.id !== lead.id)]
    : [...articles].sort((a, b) => {
        const rb =
          (b.sourceDomain?.length ?? 0) - (a.sourceDomain?.length ?? 0) ||
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        return rb;
      });

  for (const article of ordered) {
    const url = normalizeImageUrl(article.imageUrl);
    if (url) return url;
  }
  return undefined;
}
