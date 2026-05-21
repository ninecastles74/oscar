import type { ContentTopic, TopicClassification } from "@/types/news-platform";
import { CONTENT_TOPICS } from "@/types/news-platform";
import { clampScore } from "../../reliability/utils/math";

const VALID = new Set<string>(CONTENT_TOPICS);

interface LlmTopicPayload {
  topics?: { topic: string; confidence: number }[];
  primaryTopic?: string;
}

/**
 * Optional LLM topic classification when OPENAI_API_KEY or ANTHROPIC_API_KEY is set.
 * Returns null to fall back to keyword classifier.
 */
export async function classifyTopicsWithLlm(input: {
  title: string;
  summary?: string;
  body: string;
}): Promise<TopicClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const text = [input.title, input.summary, input.body].filter(Boolean).join("\n").slice(0, 6000);
  const system = `You classify news text into topics. Return JSON only: {"topics":[{"topic":"Politics","confidence":85},...],"primaryTopic":"Politics"}. Topics must be from: ${CONTENT_TOPICS.join(", ")}. Up to 4 topics, confidence 0-100.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TOPIC_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

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
