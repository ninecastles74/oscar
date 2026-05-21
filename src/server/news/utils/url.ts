const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

/** Extract registrable domain from a URL or hostname. */
export function extractDomain(urlOrHost: string): string {
  try {
    const withProto = urlOrHost.includes("://") ? urlOrHost : `https://${urlOrHost}`;
    const host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, "");
    return host;
  } catch {
    return urlOrHost.toLowerCase().replace(/^www\./, "");
  }
}

/** Normalize URL for deduplication (canonical form). */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    u.pathname = path;
    u.protocol = u.protocol === "http:" ? "http:" : "https:";
    return u.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function urlsLikelySame(a: string, b: string): boolean {
  return canonicalizeUrl(a) === canonicalizeUrl(b);
}
