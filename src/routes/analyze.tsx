import { createFileRoute } from "@tanstack/react-router";
import { AnalyzerFormView } from "@/features/manual-analyzer/analyzer-form-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/analyze")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.ask) }] }),
  component: AnalyzerFormView,
});
