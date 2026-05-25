import type { Category } from "@/types/news-platform";
import { inferArticleCategory } from "./category-inference";

export const NEWS_CATEGORIES: Category[] = [
  "Politics",
  "World",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Climate",
  "Markets",
  "Sports",
  "Entertainment",
  "General",
];

const VALID = new Set<string>(NEWS_CATEGORIES);

type LlmCategoryResult = { key: string; category: string };

type LlmCategoryPayload = { results?: LlmCategoryResult[] };

const CHUNK_SIZE = 35;

function coerceLlmCategory(raw: string | undefined): Category | null {
  if (!raw) return null;
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (VALID.has(titled)) return titled as Category;
  if (raw === "Tech") return "Technology";
  if (raw === "Economy" || raw === "Finance") return "Markets";
  return null;
}

/**
 * Classify headlines with OpenAI (headline only). Returns partial map; missing keys use keyword fallback.
 */
export async function classifyCategoriesWithLlm(
  items: { key: string; title: string }[],
): Promise<Map<string, Category>> {
  const out = new Map<string, Category>();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || items.length === 0) return out;

  const model = process.env.OPENAI_CATEGORY_MODEL ?? process.env.OPENAI_TOPIC_MODEL ?? "gpt-4o-mini";

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const numbered = chunk.map((item, idx) => `${idx + 1}. key="${item.key}" | ${item.title}`);
    const system = `You classify news headlines into exactly one category each.
Categories (use exact spelling): ${NEWS_CATEGORIES.join(", ")}.
Return JSON only: {"results":[{"key":"<same key>","category":"Sports"},...]}
Use only the headline text. No explanation.`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: numbered.join("\n") },
          ],
        }),
      });

      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) continue;

      const parsed = JSON.parse(raw) as LlmCategoryPayload;
      for (const row of parsed.results ?? []) {
        const cat = coerceLlmCategory(row.category);
        if (cat && row.key) out.set(row.key, cat);
      }
    } catch {
      /* fall through to keyword per item */
    }
  }

  return out;
}

/** LLM headline category when API key is set; otherwise keyword inference. */
export async function resolveArticleCategory(
  title: string,
  description?: string,
  feedHint?: string,
  cacheKey?: string,
): Promise<Category> {
  const key = cacheKey ?? `single:${title.slice(0, 120)}`;
  const llm = await classifyCategoriesWithLlm([{ key, title: title.trim() }]);
  return llm.get(key) ?? inferArticleCategory(title, description, feedHint);
}
