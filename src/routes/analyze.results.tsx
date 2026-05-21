import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { ReportView } from "@/features/reports/report-view";
import { getManualAnalysis } from "@/server/analysis/functions";

const searchSchema = z.object({
  id: z.string().min(1),
});

export const Route = createFileRoute("/analyze/results")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Analysis results — Veridict" }] }),
  loaderDeps: ({ search }) => ({ requestId: search.id }),
  loader: async ({ deps }) => {
    const result = await getManualAnalysis({ data: { requestId: deps.requestId } });

    if ("error" in result && result.error && typeof result.error === "object") {
      if ("code" in result.error && result.error.code === "NOT_FOUND") {
        throw redirect({ to: "/analyze" });
      }
      return { error: result.error, requestId: deps.requestId };
    }

    if (!result.report) {
      return { pending: true, requestId: deps.requestId, status: result.status };
    }

    return {
      report: analysisReportToManualReport(result.report),
      platformReport: result.report,
      explainability: "explainability" in result ? result.explainability : undefined,
      requestId: deps.requestId,
      submission: result.submission,
    };
  },
  component: AnalyzeResultsPage,
});

function AnalyzeResultsPage() {
  const data = Route.useLoaderData();

  if ("error" in data && data.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Analysis failed</h1>
        <p className="mt-2 text-sm text-muted-foreground">{data.error.message}</p>
        <Link
          to="/analyze"
          className="mt-6 inline-block text-sm font-medium text-accent hover:underline"
        >
          Try again
        </Link>
      </main>
    );
  }

  if ("pending" in data && data.pending) {
    return (
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="font-serif text-2xl font-semibold">Analysis in progress</h1>
        <p className="mt-2 text-sm text-muted-foreground">Status: {data.status ?? "processing"}</p>
      </main>
    );
  }

  if (!("report" in data) || !data.report) {
    return null;
  }

  return (
    <ReportView
      report={data.report}
      platformReport={"platformReport" in data ? data.platformReport : undefined}
      explainability={"explainability" in data ? data.explainability : undefined}
    />
  );
}
