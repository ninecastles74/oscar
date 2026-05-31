/** JSON schemas aligned with provider structured-output APIs. */

export const VERDICT_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["supported", "disputed", "unclear", "insufficient_evidence"],
    },
    confidence: { type: "number" },
    reasoning: { type: "string" },
  },
  required: ["verdict", "confidence", "reasoning"],
  additionalProperties: false,
} as const;

export const CLAIMS_JSON_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
} as const;

export const TOPICS_JSON_SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["topic", "confidence"],
        additionalProperties: false,
      },
    },
    primaryTopic: { type: "string" },
  },
  required: ["topics", "primaryTopic"],
  additionalProperties: false,
} as const;
