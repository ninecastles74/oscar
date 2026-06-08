import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleAnalyzeArticle } from "@/server/api/analyze-handlers";

export const Route = createFileRoute("/api/analyze/article")({
  server: {
    handlers: {
      POST: async ({ request }) => handleAnalyzeArticle(request),
    },
  },
});
