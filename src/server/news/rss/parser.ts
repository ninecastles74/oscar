import type { Category } from "@/types/news-platform";
import type { ArticleImageSource } from "@/types/news-platform";
import { coerceCategory } from "../normalize";
import { inferArticleCategory } from "../category-inference";
import { isLikelyFullArticleBody, sanitizeRssSummary, stripHtml } from "./content-policy";
import { parseFeedAuthor } from "./feed-author";
import type { RssFeedRegistryEntry } from "./registry";

export interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  author?: string;
  category: Category;
  imageUrl?: string;
  imageSource: ArticleImageSource;
  externalId?: string;
}

function tagContent(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

function attrUrl(block: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = block.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function parseCategories(
  block: string,
  fallback: Category,
  title: string,
  description: string,
): Category {
  const tags = block.match(/<category[^>]*>([\s\S]*?)<\/category>/gi) ?? [];
  for (const tag of tags) {
    const inner = tag.replace(/<\/?category[^>]*>/gi, "").trim();
    const label = stripHtml(inner);
    if (label) return inferArticleCategory(title, description, coerceCategory(label));
  }
  return inferArticleCategory(title, description, fallback);
}

function parseImage(
  block: string,
  includeImage: boolean,
): { url?: string; source: ArticleImageSource } {
  if (!includeImage) return { source: "none" };

  const url =
    attrUrl(block, [
      /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
      /<media:content[^>]+url=["']([^"']+)["'][^>]*(?:medium=["']image|type=["']image)/i,
      /<media:content[^>]+medium=["']image[^>]+url=["']([^"']+)["']/i,
      /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image\/[^"']+["']/i,
      /<enclosure[^>]+type=["']image\/[^"']+["'][^>]+url=["']([^"']+)["']/i,
    ]) ?? undefined;

  if (!url) return { source: "none" };
  const source: ArticleImageSource = block.includes("media:thumbnail")
    ? "media_thumbnail"
    : block.includes("enclosure")
      ? "enclosure"
      : "media_content";
  return { url, source };
}

function pickDescription(block: string, title: string): string {
  const description = tagContent(block, "description");
  const summary = tagContent(block, "summary");
  const encoded = tagContent(block, "content:encoded") ?? tagContent(block, "content");

  if (description && !isLikelyFullArticleBody(description)) return stripHtml(description);
  if (summary && !isLikelyFullArticleBody(summary)) return stripHtml(summary);
  if (encoded && !isLikelyFullArticleBody(encoded)) return stripHtml(encoded);
  return title;
}

function parseRss2Items(xml: string, feed: RssFeedRegistryEntry): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of blocks) {
    const title = stripHtml(tagContent(block, "title") ?? "");
    const link = tagContent(block, "link") ?? tagContent(block, "guid");
    if (!title || !link) continue;

    const rawDesc = pickDescription(block, title);
    const { summary } = sanitizeRssSummary(rawDesc, title);
    const pubDate = tagContent(block, "pubDate") ?? tagContent(block, "dc:date");
    const author = parseFeedAuthor(block, "rss");
    const { url: imageUrl, source: imageSource } = parseImage(block, feed.includeImage);
    const category = parseCategories(block, feed.category, title, summary);
    const externalId = tagContent(block, "guid") ?? link;

    items.push({
      title,
      link: link.trim(),
      description: summary,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      author: author ? stripHtml(author) : undefined,
      category,
      imageUrl,
      imageSource,
      externalId,
    });
  }
  return items;
}

function parseAtomItems(xml: string, feed: RssFeedRegistryEntry): ParsedRssItem[] {
  const items: ParsedRssItem[] = [];
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of entries) {
    const title = stripHtml(tagContent(block, "title") ?? "");
    const link = attrUrl(block, [/<link[^>]+href=["']([^"']+)["']/i]) ?? tagContent(block, "id");
    if (!title || !link) continue;

    const rawDesc = tagContent(block, "summary") ?? tagContent(block, "content") ?? title;
    const desc = isLikelyFullArticleBody(rawDesc) ? title : stripHtml(rawDesc);
    const { summary } = sanitizeRssSummary(desc, title);
    const updated = tagContent(block, "updated") ?? tagContent(block, "published");
    const author = parseFeedAuthor(block, "atom");
    const { url: imageUrl, source: imageSource } = parseImage(block, feed.includeImage);
    const category = parseCategories(block, feed.category, title, summary);

    items.push({
      title,
      link: link.trim(),
      description: summary,
      publishedAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
      author: author ? stripHtml(author) : undefined,
      category,
      imageUrl,
      imageSource,
      externalId: tagContent(block, "id") ?? link,
    });
  }
  return items;
}

export function parseFeedXml(xml: string, feed: RssFeedRegistryEntry): ParsedRssItem[] {
  const lower = xml.slice(0, 800).toLowerCase();
  const items =
    lower.includes("<feed") && !lower.includes("<rss")
      ? parseAtomItems(xml, feed)
      : parseRss2Items(xml, feed);
  return items.slice(0, feed.maxItemsPerFetch);
}
