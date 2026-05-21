import { extractDomain } from "../../news/utils/url";

export function authorIdFromName(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  let h = 0;
  const n = name.trim().toLowerCase();
  for (let i = 0; i < n.length; i++) h = (h << 5) - h + n.charCodeAt(i);
  return `author_${Math.abs(h).toString(36)}`;
}

export function organizationIdFromDomain(domain: string): string {
  const d = extractDomain(domain);
  return `org_${d.replace(/\./g, "_")}`;
}

export function organizationIdForUrl(url: string): string {
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  return organizationIdFromDomain(extractDomain(normalized));
}
