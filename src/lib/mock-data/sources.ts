import type { Source } from "./types";

/** UI mock sources — aligned with major US/world registry on server. */
export const SOURCES: Source[] = [
  { id: "s1", name: "Reuters", domain: "reuters.com", bias: "center", reliability: 96, approved: true },
  { id: "s2", name: "Associated Press", domain: "apnews.com", bias: "center", reliability: 95, approved: true },
  { id: "s3", name: "BBC News", domain: "bbc.com", bias: "center", reliability: 92, approved: true },
  { id: "s4", name: "The New York Times", domain: "nytimes.com", bias: "center-left", reliability: 88, approved: true },
  { id: "s5", name: "The Wall Street Journal", domain: "wsj.com", bias: "center-right", reliability: 89, approved: true },
  { id: "fox", name: "Fox News", domain: "foxnews.com", bias: "right", reliability: 72, approved: true },
  { id: "abc", name: "ABC News", domain: "abcnews.go.com", bias: "center-left", reliability: 80, approved: true },
  { id: "nbc", name: "NBC News", domain: "nbcnews.com", bias: "center-left", reliability: 78, approved: true },
  { id: "cbs", name: "CBS News", domain: "cbsnews.com", bias: "center-left", reliability: 79, approved: true },
  { id: "cnn", name: "CNN", domain: "cnn.com", bias: "center-left", reliability: 75, approved: true },
  { id: "usnews", name: "U.S. News", domain: "usnews.com", bias: "center", reliability: 76, approved: true },
  { id: "nypost", name: "New York Post", domain: "nypost.com", bias: "right", reliability: 68, approved: true },
  { id: "washpost", name: "Washington Post", domain: "washingtonpost.com", bias: "center-left", reliability: 84, approved: true },
  { id: "s9", name: "NPR", domain: "npr.org", bias: "center-left", reliability: 87, approved: true },
  { id: "s8", name: "Bloomberg", domain: "bloomberg.com", bias: "center", reliability: 90, approved: true },
];

export function sourceById(id: string): Source {
  return SOURCES.find((s) => s.id === id)!;
}

/** Resolve mock source by id, domain, or article URL (live feed uses domain ids). */
export function sourceForStory(sourceId: string, articleUrl?: string): Source {
  const byId = SOURCES.find((s) => s.id === sourceId);
  if (byId) return byId;

  let domain = sourceId;
  if (articleUrl) {
    try {
      domain = new URL(articleUrl).hostname.replace(/^www\./, "");
    } catch {
      /* keep sourceId */
    }
  }

  const byDomain = SOURCES.find(
    (s) => s.domain === domain || domain.endsWith(`.${s.domain}`) || domain.includes(s.domain),
  );
  if (byDomain) return byDomain;

  return {
    id: sourceId,
    name: domain,
    domain,
    bias: "center",
    reliability: 70,
    approved: true,
  };
}
