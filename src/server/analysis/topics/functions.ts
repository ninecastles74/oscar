import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifyTopics } from "./classify-topics";
import { classifyTopicsSync } from "./classify-topics";
import {
  getAllTopicSourceReliabilityForOrg,
  getLatestTopicSourceReliability,
  getTopicSourceReliabilityHistory,
} from "../../reliability/topics/topic-source-store";
import { CONTENT_TOPICS } from "@/types/news-platform";

const classifySchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  body: z.string().min(20),
  claims: z
    .array(z.object({ id: z.string(), text: z.string().min(10) }))
    .optional(),
  useLlm: z.boolean().optional(),
});

const topicParamSchema = z.object({
  organizationId: z.string().min(1),
  topic: z.enum([
    "Politics",
    "Finance",
    "Science",
    "Health",
    "Technology",
    "International",
    "Crime",
    "Entertainment",
    "Sports",
  ]),
});

/** Classify article/claims into ContentTopics (async; may use LLM). */
export const classifyContentTopics = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => classifySchema.parse(data))
  .handler(async ({ data }) => {
    const claims = data.claims ?? [];
    if (data.useLlm) {
      return classifyTopics({
        title: data.title,
        summary: data.summary,
        body: data.body,
        claims,
      });
    }
    return classifyTopicsSync({
      title: data.title,
      summary: data.summary,
      body: data.body,
      claims,
    });
  });

/** List supported content topics. */
export const listContentTopics = createServerFn({ method: "GET" }).handler(async () => ({
  topics: CONTENT_TOPICS,
}));

/** Topic-specific source reliability for a publisher. */
export const getTopicSourceReliability = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => topicParamSchema.parse(data))
  .handler(async ({ data }) => {
    const latest = getLatestTopicSourceReliability(data.organizationId, data.topic);
    const history = getTopicSourceReliabilityHistory(data.organizationId, data.topic);
    if (!latest) {
      return { error: { code: "NOT_FOUND", message: "No topic reliability for this source" } };
    }
    return { latest, history, allTopics: getAllTopicSourceReliabilityForOrg(data.organizationId) };
  });
