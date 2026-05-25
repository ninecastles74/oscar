import { stripHtml } from "./content-policy";

function tagContent(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

/** Extract byline from RSS 2.0 or Atom item/entry blocks. */
export function parseFeedAuthor(block: string, format: "rss" | "atom"): string | undefined {
  if (format === "rss") {
    const raw =
      tagContent(block, "dc:creator") ??
      tagContent(block, "creator") ??
      tagContent(block, "author");
    if (raw) return cleanAuthor(raw);
  }

  const authorBlock = block.match(/<author[\s\S]*?<\/author>/i)?.[0];
  if (authorBlock) {
    const name = tagContent(authorBlock, "name");
    if (name) return cleanAuthor(name);
    const emailMatch = authorBlock.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
    if (emailMatch?.[1]) return cleanAuthor(emailMatch[1]);
  }

  const name = tagContent(block, "name");
  if (name && block.includes("<author")) return cleanAuthor(name);

  return undefined;
}

function cleanAuthor(raw: string): string | undefined {
  const text = stripHtml(raw).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.includes("@") && !text.includes(" ")) return undefined;
  return text.slice(0, 120);
}
