import type { ContentTopic, TopicClassification } from "@/types/news-platform";
import { CONTENT_TOPICS } from "@/types/news-platform";
import { clampScore } from "../../reliability/utils/math";
import { TOPIC_KEYWORD_RULES } from "./topic-keywords";
import type { ClassifyTopicsInput, ClassifyTopicsResult } from "./types";
import { classifyTopicsWithLlm } from "./llm-classifier";

const MIN_TOPIC_CONFIDENCE = 22;
const MAX_TOPICS = 4;
const DEFAULT_TOPIC: ContentTopic = "Politics";

function tokenize(text: string): string {
  return text.toLowerCase();
}

function scoreTopic(
  topic: ContentTopic,
  text: string,
  titleWeight: number,
): number {
  const rule = TOPIC_KEYWORD_RULES.find((r) => r.topic === topic);
  if (!rule) return 0;
  const hay = tokenize(text);
  let score = 0;
  for (const kw of rule.keywords) {
    if (hay.includes(kw.toLowerCase())) {
      score += kw.includes(" ") ? 3 : 1;
    }
  }
  return score * titleWeight;
}

function keywordClassify(text: string, titleWeight = 1): TopicClassification {
  const rawScores = CONTENT_TOPICS.map((topic) => ({
    topic,
    raw: scoreTopic(topic, text, titleWeight),
  }));

  const maxRaw = Math.max(1, ...rawScores.map((r) => r.raw));
  const withConfidence = rawScores
    .map((r) => ({
      topic: r.topic,
      confidence: clampScore((r.raw / maxRaw) * 100),
    }))
    .filter((t) => t.confidence >= MIN_TOPIC_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_TOPICS);

  if (withConfidence.length === 0) {
    return {
      topics: [{ topic: DEFAULT_TOPIC, confidence: 40 }],
      primaryTopic: DEFAULT_TOPIC,
      primaryConfidence: 40,
      classifier: "keyword",
    };
  }

  const primary = withConfidence[0];
  return {
    topics: withConfidence,
    primaryTopic: primary.topic,
    primaryConfidence: primary.confidence,
    classifier: "keyword",
  };
}

function mergeClassifications(
  a: TopicClassification,
  b: TopicClassification,
): TopicClassification {
  const merged = new Map<ContentTopic, number>();
  for (const t of [...a.topics, ...b.topics]) {
    merged.set(t.topic, Math.max(merged.get(t.topic) ?? 0, t.confidence));
  }
  const topics = [...merged.entries()]
    .map(([topic, confidence]) => ({ topic, confidence }))
    .sort((x, y) => y.confidence - x.confidence)
    .slice(0, MAX_TOPICS);
  const primary = topics[0];
  return {
    topics,
    primaryTopic: primary.topic,
    primaryConfidence: primary.confidence,
    classifier: "hybrid",
  };
}

/**
 * Classify article + claims into ContentTopics with confidence scores.
 * Uses LLM when configured; otherwise keyword model.
 */
export async function classifyTopics(input: ClassifyTopicsInput): Promise<ClassifyTopicsResult> {
  const articleText = [input.title, input.summary, input.body].filter(Boolean).join("\n");
  let article = keywordClassify(articleText, 1.8);

  const llmArticle = await classifyTopicsWithLlm({
    title: input.title,
    summary: input.summary,
    body: input.body,
  });
  if (llmArticle) {
    article = mergeClassifications(article, llmArticle);
  }

  const claimClassifications: Record<string, TopicClassification> = {};
  for (const claim of input.claims) {
    let claimTopics = keywordClassify(claim.text, 1);
    const llmClaim = await classifyTopicsWithLlm({
      title: input.title,
      body: claim.text,
    });
    if (llmClaim) {
      claimTopics = mergeClassifications(claimTopics, llmClaim);
    }
    claimClassifications[claim.id] = claimTopics;
  }

  return {
    article,
    claimClassifications,
  };
}

/** Synchronous keyword-only path for pipelines without async. */
export function classifyTopicsSync(input: ClassifyTopicsInput): ClassifyTopicsResult {
  const articleText = [input.title, input.summary, input.body].filter(Boolean).join("\n");
  const article = keywordClassify(articleText, 1.8);
  const claimClassifications: Record<string, TopicClassification> = {};
  for (const claim of input.claims) {
    claimClassifications[claim.id] = keywordClassify(claim.text, 1);
  }
  return { article, claimClassifications };
}
