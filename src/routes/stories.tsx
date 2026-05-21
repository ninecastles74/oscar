import { createFileRoute } from "@tanstack/react-router";
import { Top100View } from "@/features/story-clusters/top-100-view";

export const Route = createFileRoute("/stories")({
  head: () => ({ meta: [{ title: "Top 100 stories — Veridict" }] }),
  component: Top100View,
});
