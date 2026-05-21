/** Max characters stored from RSS description/summary (not full article HTML). */
export const RSS_SUMMARY_MAX_LENGTH = 500;

/**
 * RSS feeds must not persist full copyrighted article bodies unless explicitly licensed.
 * We only keep short feed-provided descriptions/summaries.
 */
export function sanitizeRssSummary(
  raw: string | undefined,
  title: string,
): {
  summary: string;
  summarySource: "rss_description" | "rss_summary" | "title_fallback";
} {
  const stripped = stripHtml(raw ?? "").trim();
  if (stripped.length >= 20) {
    return {
      summary: stripped.slice(0, RSS_SUMMARY_MAX_LENGTH),
      summarySource:
        stripped.length > 0 && raw?.toLowerCase().includes("summary")
          ? "rss_summary"
          : "rss_description",
    };
  }
  return {
    summary: title.slice(0, RSS_SUMMARY_MAX_LENGTH),
    summarySource: "title_fallback",
  };
}

/** Strip tags and collapse whitespace; never treat content:encoded as storable full text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reject content:encoded and long HTML bodies for storage. */
export function isLikelyFullArticleBody(text: string): boolean {
  const stripped = stripHtml(text);
  return stripped.length > RSS_SUMMARY_MAX_LENGTH * 2 || /<\/p>\s*<p/i.test(text);
}
