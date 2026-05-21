import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/features/news-monitor/dashboard-view";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Veridict" }] }),
  component: DashboardView,
});
