import type { EvidenceDocumentType, EvidenceItem } from "@/types/news-platform";

interface ClassifierRule {
  type: EvidenceDocumentType;
  priority: number;
  url?: RegExp;
  excerpt?: RegExp;
}

const RULES: ClassifierRule[] = [
  {
    type: "court_document",
    priority: 100,
    url: /\b(court|judiciary|pacer|uscourts|docket)\b/i,
    excerpt:
      /\b(court (order|filing|document)|indictment|affidavit|judicial record|docket entry)\b/i,
  },
  {
    type: "official_filing",
    priority: 95,
    url: /\b(sec\.gov|edgar|federalregister|regulations\.gov|\.gov\/)\b/i,
    excerpt:
      /\b(SEC filing|Form 10-?K|official filing|regulatory filing|federal register|agency filing)\b/i,
  },
  {
    type: "verified_dataset",
    priority: 90,
    excerpt:
      /\b(dataset|statistical release|BLS data|Census data|peer-reviewed data|official statistics)\b/i,
  },
  {
    type: "direct_video_audio",
    priority: 88,
    url: /\b(youtube|vimeo|\.mp4|audio|recording)\b/i,
    excerpt:
      /\b(video (shows|footage)|audio recording|livestream|body-?cam|press conference recording)\b/i,
  },
  {
    type: "unsourced_social",
    priority: 85,
    url: /\b(twitter\.com|x\.com|facebook\.com|tiktok|instagram|reddit\.com\/r\/)\b/i,
    excerpt: /\b(tweeted|viral post|social media post|unverified post)\b/i,
  },
  {
    type: "opinion_article",
    priority: 80,
    excerpt: /\b(op-?ed|editorial|commentary|columnist argues|in my view|we believe)\b/i,
    url: /\/opinion\//i,
  },
  {
    type: "anonymous_sourcing",
    priority: 75,
    excerpt:
      /\b(anonymous (source|official)|unnamed official|people familiar with|sources (said|told)|insider said)\b/i,
  },
  {
    type: "syndicated_rewrite",
    priority: 70,
    excerpt: /\b(syndicated|reprinted|via reuters|via ap|from reuters|from ap|wire report)\b/i,
  },
  {
    type: "secondary_summary",
    priority: 65,
    excerpt: /\b(according to|reported by|per |citing |as reported|summary of|roundup)\b/i,
  },
  {
    type: "firsthand_reporting",
    priority: 60,
    excerpt:
      /\b(witnessed|on the scene|our reporter|eyewitness|direct observation|interviewed the)\b/i,
  },
];

/**
 * Classify evidence into a document type from URL and excerpt signals.
 */
export function classifyEvidenceType(item: EvidenceItem): EvidenceDocumentType {
  let best: EvidenceDocumentType = "standard_reporting";
  let bestPriority = 0;

  for (const rule of RULES) {
    const urlMatch = rule.url?.test(item.url) ?? false;
    const excerptMatch = rule.excerpt?.test(item.excerpt) ?? false;
    if ((urlMatch || excerptMatch) && rule.priority > bestPriority) {
      bestPriority = rule.priority;
      best = rule.type;
    }
  }

  if (item.isDirectQuote && best === "standard_reporting") {
    return "firsthand_reporting";
  }

  return best;
}
