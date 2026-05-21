import { createFileRoute } from "@tanstack/react-router";
import { PipelineView } from "@/features/news-monitor/pipeline-view";

export const Route = createFileRoute("/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — Veridict" }] }),
  component: PipelineView,
});
