import { createFileRoute } from "@tanstack/react-router";
import { PipelineView } from "@/features/news-monitor/pipeline-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/pipeline")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.pipeline) }] }),
  component: PipelineView,
});
