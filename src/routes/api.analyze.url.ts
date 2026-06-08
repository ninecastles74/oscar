import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleAnalyzeUrl } from "@/server/api/analyze-handlers";

export const Route = createFileRoute("/api/analyze/url")({
  server: {
    handlers: {
      POST: async ({ request }) => handleAnalyzeUrl(request),
    },
  },
});
