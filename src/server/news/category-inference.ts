import type { Category } from "@/types/news-platform";
import { coerceCategory } from "./normalize";

const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: "Sports",
    keywords: [
      " nfl ",
      " nba ",
      " mlb ",
      " nhl ",
      " soccer ",
      " football ",
      " basketball ",
      " baseball ",
      " hockey ",
      " tennis ",
      " olympics ",
      " world cup ",
      " championship ",
      " playoffs ",
      " quarterback ",
      " coach ",
      " athlete ",
      " lakers ",
      " yankees ",
      " premier league ",
    ],
  },
  {
    category: "Science",
    keywords: [
      " scientist ",
      " researchers ",
      " study finds ",
      " climate ",
      " space ",
      " nasa ",
      " telescope ",
      " genome ",
      " physics ",
      " biology ",
      " chemistry ",
      " laboratory ",
      " discovery ",
      " species ",
      " asteroid ",
      " vaccine trial ",
    ],
  },
  {
    category: "Health",
    keywords: [
      " health ",
      " hospital ",
      " disease ",
      " virus ",
      " covid ",
      " cancer ",
      " mental health ",
      " fda ",
      " cdc ",
      " patients ",
      " medical ",
      " doctor ",
      " drug ",
      " outbreak ",
      " symptoms ",
    ],
  },
  {
    category: "Technology",
    keywords: [
      " tech ",
      " technology ",
      " apple ",
      " google ",
      " microsoft ",
      " ai ",
      " artificial intelligence ",
      " startup ",
      " smartphone ",
      " cyber ",
      " software ",
      " chip ",
      " semiconductor ",
      " openai ",
      " meta ",
      " amazon ",
    ],
  },
  {
    category: "Markets",
    keywords: [
      " stocks ",
      " markets ",
      " s&p ",
      " dow ",
      " nasdaq ",
      " earnings ",
      " inflation ",
      " fed ",
      " interest rate ",
      " wall street ",
      " investors ",
      " trading ",
      " gdp ",
      " recession ",
      " treasury ",
    ],
  },
  {
    category: "Business",
    keywords: [
      " business ",
      " corporate ",
      " ceo ",
      " company ",
      " merger ",
      " acquisition ",
      " revenue ",
      " profit ",
      " layoffs ",
      " industry ",
      " economy ",
      " retail ",
      " airline ",
    ],
  },
  {
    category: "Politics",
    keywords: [
      " election ",
      " congress ",
      " senate ",
      " white house ",
      " president ",
      " governor ",
      " democrat ",
      " republican ",
      " parliament ",
      " minister ",
      " legislation ",
      " ballot ",
      " campaign ",
      " trump ",
      " biden ",
    ],
  },
  {
    category: "Climate",
    keywords: [
      " climate change ",
      " global warming ",
      " carbon ",
      " emissions ",
      " renewable ",
      " wildfire ",
      " hurricane ",
      " flood ",
      " drought ",
      " sea level ",
    ],
  },
  {
    category: "Entertainment",
    keywords: [
      " movie ",
      " film ",
      " hollywood ",
      " actor ",
      " actress ",
      " music ",
      " concert ",
      " album ",
      " netflix ",
      " disney ",
      " celebrity ",
      " box office ",
      " grammy ",
      " oscars ",
    ],
  },
  {
    category: "World",
    keywords: [
      " war ",
      " ukraine ",
      " russia ",
      " gaza ",
      " israel ",
      " china ",
      " nato ",
      " united nations ",
      " refugee ",
      " military ",
      " conflict ",
      " diplomatic ",
      " sanctions ",
    ],
  },
];

const GENERIC_FEED_LABELS = new Set([
  "news",
  "top stories",
  "top news",
  "headlines",
  "latest",
  "breaking",
  "general",
  "home",
  "homepage",
  "all",
]);

/** Infer story category from headline and summary (overrides generic RSS feed labels). */
export function inferArticleCategory(
  title: string,
  description?: string,
  feedHint?: string,
): Category {
  const hay = ` ${title} ${description ?? ""} `.toLowerCase();
  let best: Category = "General";
  let bestScore = 0;

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (hay.includes(kw)) score += kw.trim().length > 6 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = rule.category;
    }
  }

  if (bestScore > 0) return best;

  const hint = feedHint?.trim();
  if (hint && !GENERIC_FEED_LABELS.has(hint.toLowerCase())) {
    return coerceCategory(hint);
  }

  return "General";
}

/** Pick cluster category from member articles (content-first). */
export function dominantCategoryFromArticles(
  members: { category: Category }[],
): Category {
  const counts = new Map<Category, number>();
  for (const m of members) {
    counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  }
  let best: Category = "General";
  let max = 0;
  for (const [cat, n] of counts) {
    if (n > max && cat !== "General") {
      max = n;
      best = cat;
    }
  }
  if (max > 0) return best;
  for (const [cat, n] of counts) {
    if (n > max) {
      max = n;
      best = cat;
    }
  }
  return best;
}
