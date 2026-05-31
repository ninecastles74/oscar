import type { ContentTopic, TopicClassification } from "@/types/news-platform";
import { CONTENT_TOPICS } from "@/types/news-platform";
import { openAiChatCompletion } from "../../ai/openai-client";
import { TOPICS_JSON_SCHEMA } from "../../ai/llm-schemas";
import { resolveOpenAiTopicModel } from "../../ai/openai-models";
import { isOpenAiConfigured } from "../../env/server-env";
import { clampScore } from "../../reliability/utils/math";

const VALID = new Set<string>(CONTENT_TOPICS);

interface LlmTopicPayload {
  topics?: { topic: string; confidence: number }[];
  primaryTopic?: string;
}

/**
 * Optional LLM topic classification when OPENAI_API_KEY is set.
 * Returns null to fall back to keyword classifier.
 */
export async function classifyTopicsWithLlm(input: {
  title: string;
  summary?: string;
  body: string;
}): Promise<TopicClassification | null> {
  if (!isOpenAiConfigured()) return null;

  const text = [input.title, input.summary, input.body].filter(Boolean).join("\n").slice(0, 6000);
  const system = `You classify news text into topics. Topics must be from: ${CONTENT_TOPICS.join(", ")}. Up to 4 topics, confidence 0-100.`;

  const raw = await openAiChatCompletion({
    model: resolveOpenAiTopicModel(),
    system,
    user: text,
    temperature: 0.1,
    maxTokens: 512,
    jsonSchema: TOPICS_JSON_SCHEMA,
    jsonSchemaName: "topic_classification",
  });

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LlmTopicPayload;
    const topics = (parsed.topics ?? [])
      .filter((t) => VALID.has(t.topic))
      .map((t) => ({
        topic: t.topic as ContentTopic,
        confidence: clampScore(Number(t.confidence) || 0),
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4);

    if (topics.length === 0) return null;

    const primaryTopic = VALID.has(parsed.primaryTopic ?? "")
      ? (parsed.primaryTopic as ContentTopic)
      : topics[0].topic;

    return {
      topics,
      primaryTopic,
      primaryConfidence: topics.find((t) => t.topic === primaryTopic)?.confidence ?? topics[0].confidence,
      classifier: "llm",
    };
  } catch {
    return null;
  }
}
