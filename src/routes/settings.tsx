import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/app/settings-view";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings & API keys — Veridict" }] }),
  component: SettingsView,
});
