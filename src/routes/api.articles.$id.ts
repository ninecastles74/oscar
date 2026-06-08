import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleArticleById } from "@/server/api/stories-handlers";

export const Route = createFileRoute("/api/articles/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => handleArticleById(params.id),
    },
  },
});
