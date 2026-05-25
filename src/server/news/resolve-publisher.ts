import type { ArticleSource } from "@/types/news-platform";
import { APPROVED_SOURCES } from "../analysis/sources";
import { extractDomain } from "./utils/url";

export interface ResolvedPublisher {
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
}

function matchByDomain(domain: string): ArticleSource | undefined {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return APPROVED_SOURCES.find(
    (s) =>
      d === s.domain ||
      d.endsWith(`.${s.domain}`) ||
      s.domain.endsWith(`.${d}`) ||
      d.includes(s.domain),
  );
}

/** Map ingest domain / slug to canonical approved publisher metadata. */
export function resolvePublisher(input: {
  sourceId?: string;
  sourceDomain?: string;
  sourceName?: string;
  url?: string;
}): ResolvedPublisher {
  const articleDomain = extractDomain(input.url || "");
  const feedDomain = extractDomain(input.sourceDomain || "");
  const domain =
    articleDomain !== "unknown"
      ? articleDomain
      : feedDomain !== "unknown"
        ? feedDomain
        : "unknown";

  const feedLabel = input.sourceName?.trim();
  const byDomain = matchByDomain(domain);
  // Shared registry ids (e.g. s3 for all BBC feeds) must not override the feed's display name.
  const byId =
    !byDomain && input.sourceId
      ? APPROVED_SOURCES.find((s) => s.id === input.sourceId)
      : undefined;
  const src = byDomain ?? byId;

  if (src) {
    return {
      sourceId: src.id,
      sourceName: feedLabel || src.name,
      sourceDomain: domain !== "unknown" ? domain : src.domain,
    };
  }

  const cleanName =
    input.sourceName && input.sourceName !== domain && !input.sourceName.includes("://")
      ? input.sourceName
      : domain;

  return {
    sourceId: input.sourceId && !input.sourceId.includes(".") ? input.sourceId : domain.replace(/\./g, "_"),
    sourceName: cleanName,
    sourceDomain: domain,
  };
}
