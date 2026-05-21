import { createFileRoute } from "@tanstack/react-router";
import { SourcesAdminView } from "@/features/sources/sources-admin-view";

export const Route = createFileRoute("/admin/sources")({
  head: () => ({ meta: [{ title: "Sources — Veridict admin" }] }),
  component: SourcesAdminView,
});
