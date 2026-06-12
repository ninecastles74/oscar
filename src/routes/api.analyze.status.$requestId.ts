import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleGetManualAnalysis } from "@/server/api/analyze-handlers";

export const Route = createFileRoute("/api/analyze/status/$requestId")({
  server: {
    handlers: {
      GET: async ({ params }) => handleGetManualAnalysis(params.requestId),
    },
  },
});
