import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { handleStoriesTop100 } from "@/server/api/stories-handlers";

export const Route = createFileRoute("/api/stories/top-100")({
  server: {
    handlers: {
      GET: async () => handleStoriesTop100(),
    },
  },
});
