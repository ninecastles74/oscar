import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { buildHealthPayload } from "@/server/api/health";
import { jsonOk } from "@/server/api/response";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => jsonOk(await buildHealthPayload()),
    },
  },
});
