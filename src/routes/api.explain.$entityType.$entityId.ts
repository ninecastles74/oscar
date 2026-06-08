import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleExplain } from "@/server/api/stories-handlers";

export const Route = createFileRoute("/api/explain/$entityType/$entityId")({
  server: {
    handlers: {
      GET: async ({ params }) => handleExplain(params.entityType, params.entityId),
    },
  },
});
