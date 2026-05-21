import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Category, HistoricalEntityType } from "@/types/news-platform";
import {
  getAuthorReliabilityTrend,
  getConfidenceTrend,
  getContradictionTrend,
  getEntityTrendDashboard,
  getSensationalismTrend,
  getSourceReliabilityTrend,
  getTopicReliabilityTrend,
} from "./trend-analytics.service";
import { getLatestAuthor, getLatestOrganization } from "../store";
import { APPROVED_SOURCES } from "../../analysis/sources";

const categorySchema = z.enum([
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
]);

const entityTypeSchema = z.enum(["article", "source", "author", "topic"]);

const trendQuerySchema = z.object({
  entityId: z.string().min(1),
  entityType: entityTypeSchema.optional(),
  topic: categorySchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["point", "day"]).optional(),
});

const sourceQuerySchema = z.object({
  organizationId: z.string().min(1),
  topic: categorySchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["point", "day"]).optional(),
});

const authorQuerySchema = z.object({
  authorId: z.string().min(1),
  topic: categorySchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["point", "day"]).optional(),
});

const topicQuerySchema = z.object({
  topic: categorySchema,
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["point", "day"]).optional(),
});

const metricTrendSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().min(1),
  topic: categorySchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["point", "day"]).optional(),
});

function orgLabel(organizationId: string): string | undefined {
  const domain = organizationId.replace(/^org_/, "").replace(/_/g, ".");
  const src = APPROVED_SOURCES.find((s) => s.domain === domain || s.id === organizationId);
  return src?.name ?? getLatestOrganization(organizationId)?.name;
}

function resolveEntity(
  entityType: HistoricalEntityType,
  entityId: string,
): { entityType: HistoricalEntityType; entityId: string; entityLabel?: string } {
  if (entityType === "source") {
    return { entityType, entityId, entityLabel: orgLabel(entityId) };
  }
  if (entityType === "author") {
    return {
      entityType,
      entityId,
      entityLabel: getLatestAuthor(entityId)?.displayName,
    };
  }
  return { entityType, entityId, entityLabel: entityId };
}

type TrendOpts = {
  topic?: Category;
  from?: string;
  to?: string;
  granularity?: "point" | "day";
  entityLabel?: string;
};

/** Source reliability trend graph (overall + rolling). */
export const getSourceReliabilityTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => sourceQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const graph = getSourceReliabilityTrend(data.organizationId, {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: orgLabel(data.organizationId),
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No historical snapshots for this source" } };
    }
    return graph;
  });

/** Author reliability trend graph. */
export const getAuthorReliabilityTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => authorQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const graph = getAuthorReliabilityTrend(data.authorId, {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: getLatestAuthor(data.authorId)?.displayName,
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No historical snapshots for this author" } };
    }
    return graph;
  });

/** Topic reliability trend graph. */
export const getTopicReliabilityTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => topicQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const graph = getTopicReliabilityTrend(data.topic as Category, {
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: data.topic,
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No historical snapshots for this topic" } };
    }
    return graph;
  });

/** Contradiction trend analysis graph. */
export const getContradictionTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => metricTrendSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = resolveEntity(data.entityType, data.entityId);
    const opts: TrendOpts = {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: resolved.entityLabel,
    };
    const graph = getContradictionTrend(resolved.entityType, resolved.entityId, opts);
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No contradiction history for this entity" } };
    }
    return graph;
  });

/** Sensationalism trend analysis graph. */
export const getSensationalismTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => metricTrendSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = resolveEntity(data.entityType, data.entityId);
    const graph = getSensationalismTrend(resolved.entityType, resolved.entityId, {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: resolved.entityLabel,
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No sensationalism history for this entity" } };
    }
    return graph;
  });

/** Confidence trend analysis graph. */
export const getConfidenceTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => metricTrendSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = resolveEntity(data.entityType, data.entityId);
    const graph = getConfidenceTrend(resolved.entityType, resolved.entityId, {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: resolved.entityLabel,
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No confidence history for this entity" } };
    }
    return graph;
  });

/** Unified trend graph API — entity dashboard with multiple metrics. */
export const getEntityTrendGraph = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => trendQuerySchema.parse(data))
  .handler(async ({ data }) => {
    const entityType = (data.entityType ?? inferEntityType(data.entityId)) as HistoricalEntityType;
    const resolved = resolveEntity(entityType, data.entityId);
    const graph = getEntityTrendDashboard(resolved.entityType, resolved.entityId, {
      topic: data.topic as Category | undefined,
      from: data.from,
      to: data.to,
      granularity: data.granularity,
      entityLabel: resolved.entityLabel,
    });
    if (graph.series.every((s) => s.points.length === 0)) {
      return { error: { code: "NOT_FOUND", message: "No trend history for this entity" } };
    }
    return graph;
  });

function inferEntityType(entityId: string): HistoricalEntityType {
  if (entityId.startsWith("org_")) return "source";
  if (entityId.startsWith("auth_")) return "author";
  if (entityId.startsWith("art_") || entityId.includes("-")) return "article";
  const topics = [
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
  if (topics.includes(entityId)) return "topic";
  return "article";
}
