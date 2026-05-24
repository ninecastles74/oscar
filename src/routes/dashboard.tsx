import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/news-monitor/dashboard-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.signals) }] }),
  component: DashboardView,
});
