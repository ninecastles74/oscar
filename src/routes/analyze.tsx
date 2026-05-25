import { Outlet, createFileRoute } from "@tanstack/react-router";

/** Layout for Ask Oscar — child routes: index (form), results (report). */
export const Route = createFileRoute("/analyze")({
  component: AnalyzeLayout,
});

function AnalyzeLayout() {
  return <Outlet />;
}
