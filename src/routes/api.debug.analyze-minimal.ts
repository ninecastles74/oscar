import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleDebugAnalyzeMinimal } from "@/server/api/debug-handlers";

export const Route = createFileRoute("/api/debug/analyze-minimal")({
  server: {
    handlers: {
      POST: async ({ request }) => handleDebugAnalyzeMinimal(request),
    },
  },
});
