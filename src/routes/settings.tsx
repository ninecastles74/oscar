import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/app/settings-view";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: pageTitle("Settings & API keys") }] }),
  component: SettingsView,
});
