import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleDebugArticle } from "@/server/api/stories-handlers";

export const Route = createFileRoute("/api/debug/article/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => handleDebugArticle(params.id),
    },
  },
});
