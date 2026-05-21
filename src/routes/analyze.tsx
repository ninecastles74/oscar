import { createFileRoute } from "@tanstack/react-router";
import { AnalyzerFormView } from "@/features/manual-analyzer/analyzer-form-view";

export const Route = createFileRoute("/analyze")({
  head: () => ({ meta: [{ title: "Analyze an article — Veridict" }] }),
  component: AnalyzerFormView,
});
