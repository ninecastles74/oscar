import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleStoryById } from "@/server/api/stories-handlers";

export const Route = createFileRoute("/api/stories/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => handleStoryById(params.id),
    },
  },
});
