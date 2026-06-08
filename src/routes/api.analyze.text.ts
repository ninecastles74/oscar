import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleAnalyzeText } from "@/server/api/analyze-handlers";

export const Route = createFileRoute("/api/analyze/text")({
  server: {
    handlers: {
      POST: async ({ request }) => handleAnalyzeText(request),
    },
  },
});
