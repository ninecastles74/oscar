import { BRAND_NAME, OSCAR } from "@/lib/brand";
import { UserAnalysisForm } from "@/features/analysis/user-analysis-form";

export function AnalyzerFormView() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <UserAnalysisForm
        badge={OSCAR.ask}
        title={OSCAR.analysis}
        description={`Paste a URL or the full article text. ${BRAND_NAME} will extract claims, gather evidence from approved sources, and return a full ${OSCAR.analysis.toLowerCase()} report.`}
      />
      <div className="mt-10 grid grid-cols-3 gap-3 text-center">
        {[
          { v: "5", l: "free analyses / day" },
          { v: "12", l: "approved sources" },
          { v: "8h", l: "auto news refresh" },
        ].map((x) => (
          <div key={x.l} className="rounded-lg border bg-card p-4">
            <div className="font-serif text-2xl font-semibold">{x.v}</div>
            <div className="text-xs text-muted-foreground">{x.l}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
