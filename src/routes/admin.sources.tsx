import { createFileRoute } from "@tanstack/react-router";
import { SourcesAdminView } from "@/features/sources/sources-admin-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/admin/sources")({
  head: () => ({ meta: [{ title: pageTitle(`${OSCAR.sources} admin`) }] }),
  component: SourcesAdminView,
});
