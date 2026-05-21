import { AnalysisError } from "./errors";
import { stripHtml } from "../news/rss/content-policy";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
]);

const LICENSE_HINTS = [
  "creative commons",
  "cc-by",
  "public domain",
  "creativecommons.org",
  "license: cc",
];

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

export function assertUrlAllowed(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new AnalysisError("VALIDATION_ERROR", "Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AnalysisError("URL_BLOCKED", "Only http(s) URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || isPrivateIpv4(host)) {
    throw new AnalysisError("URL_BLOCKED", "URL host is not allowed");
  }
  return parsed;
}

function metaContent(html: string, attr: string, value: string): string | undefined {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m?.[1]) return decodeHtml(m[1]);
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["']`, "i");
  return re2.exec(html)?.[1] ? decodeHtml(re2.exec(html)![1]) : undefined;
}

function decodeHtml(s: string): string {
  return stripHtml(s.replace(/&amp;/g, "&").replace(/&quot;/g, '"'));
}

function detectLicense(html: string): boolean {
  const lower = html.slice(0, 50_000).toLowerCase();
  return LICENSE_HINTS.some((h) => lower.includes(h));
}

function extractExcerpt(html: string, maxLen: number): string | undefined {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const block = articleMatch?.[1] ?? html;
  const paragraphs = block.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  let text = "";
  for (const p of paragraphs) {
    const t = stripHtml(p);
    if (t.length < 40) continue;
    text += `${t} `;
    if (text.length >= maxLen) break;
  }
  const trimmed = text.trim().slice(0, maxLen);
  return trimmed.length >= 80 ? trimmed : undefined;
}

export async function fetchArticleFromUrl(
  url: string,
): Promise<import("./types").ParsedArticleInput> {
  const parsed = assertUrlAllowed(url);
  const timeout = Number(process.env.NEWS_FETCH_TIMEOUT_MS) || 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "VeridictBot/1.0 (+article-metadata)",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new AnalysisError("URL_FETCH_FAILED", `Could not fetch URL (HTTP ${res.status})`, 502);
    }

    const html = await res.text();
    const title =
      metaContent(html, "property", "og:title") ??
      metaContent(html, "name", "twitter:title") ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ??
      parsed.hostname;

    const description =
      metaContent(html, "property", "og:description") ??
      metaContent(html, "name", "description") ??
      "";

    const author =
      metaContent(html, "name", "author") ??
      metaContent(html, "property", "article:author") ??
      undefined;

    const publishedAt =
      metaContent(html, "property", "article:published_time") ??
      metaContent(html, "name", "date") ??
      undefined;

    const imageUrl = metaContent(html, "property", "og:image");
    const licensed = detectLicense(html);
    const excerpt = licensed ? extractExcerpt(html, 2000) : extractExcerpt(html, 500);

    let contentRights: import("./types").ArticleContentRights = "metadata_only";
    let analysisText = description || title;
    let rightsNote =
      "Only page metadata and short excerpt stored; full article text not reproduced without a license.";

    if (licensed && excerpt) {
      contentRights = "licensed_excerpt";
      analysisText = excerpt;
      rightsNote = "Licensed or CC-marked content: excerpt used for analysis.";
    } else if (excerpt && excerpt.length > 80) {
      contentRights = "licensed_excerpt";
      analysisText = `${description}\n\n${excerpt}`.trim().slice(0, 2500);
      rightsNote = "Short excerpt only (≤500 chars) plus metadata; not full article text.";
    }

    return {
      title: stripHtml(title).slice(0, 300),
      url: parsed.toString(),
      summary: stripHtml(description || title).slice(0, 500),
      analysisText: stripHtml(analysisText).slice(0, 8000),
      author,
      publishedAt,
      imageUrl,
      language: "en",
      contentRights,
      rightsNote,
    };
  } catch (err) {
    if (err instanceof AnalysisError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AnalysisError("URL_FETCH_FAILED", "URL fetch timed out", 504);
    }
    throw new AnalysisError("URL_FETCH_FAILED", "Failed to fetch article URL", 502);
  } finally {
    clearTimeout(timer);
  }
}
