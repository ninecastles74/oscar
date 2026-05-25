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
  const domain = extractDomain(input.sourceDomain || input.url || "unknown");
  const byId = input.sourceId
    ? APPROVED_SOURCES.find((s) => s.id === input.sourceId)
    : undefined;
  const byDomain = matchByDomain(domain);
  const src = byId ?? byDomain;

  if (src) {
    return {
      sourceId: src.id,
      sourceName: src.name,
      sourceDomain: src.domain,
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
