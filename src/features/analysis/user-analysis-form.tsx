import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { FileText, Link2, Loader2, Sparkles } from "lucide-react";
import { postJson } from "@/lib/api-client";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import { getAiUsageQuota } from "@/server/usage/functions";
import { getAccessToken } from "@/lib/auth-session";
import { getAnonymousId } from "@/lib/anonymous-id";
import { ReportView } from "@/features/reports/report-view";
import type { AnalysisReport, FinalIntelligenceSummary } from "@/types/news-platform";
import { userFacingAnalysisError } from "@/lib/user-facing-errors";

type CompletedAnalysis = {
  report: ReturnType<typeof analysisReportToManualReport>;
  platformReport: AnalysisReport;
  explainability?: unknown;
  finalIntelligence?: FinalIntelligenceSummary;
  finalAnalysis?: import("@/lib/final-analysis-report").FinalAnalysisReport;
  requestId: string;
};

function snapshotFromResponse(
  requestId: string,
  result: Record<string, unknown>,
): CompletedAnalysis | null {
  const snap = result.analysisSnapshot as
    | {
        report?: AnalysisReport;
        finalIntelligence?: FinalIntelligenceSummary;
      }
    | undefined;
  const platformReport =
    (result.platformReport as AnalysisReport | undefined) ?? snap?.report;
  if (!platformReport) return null;
  return {
    requestId,
    platformReport,
    report:
      (result.report as ReturnType<typeof analysisReportToManualReport> | undefined) ??
      analysisReportToManualReport(platformReport),
    finalIntelligence:
      (result.finalIntelligence as FinalIntelligenceSummary | undefined) ??
      snap?.finalIntelligence,
    explainability: result.explainability,
    finalAnalysis: result.finalAnalysis as CompletedAnalysis["finalAnalysis"],
  };
}

export function UserAnalysisForm({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}) {
  const [tab, setTab] = useState<"url" | "text">("url");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [completed, setCompleted] = useState<CompletedAnalysis | null>(null);

  useEffect(() => {
    void (async () => {
      const token = await getAccessToken();
      const res = await getAiUsageQuota({
        data: { accessToken: token, anonymousId: getAnonymousId() },
      });
      if (res?.quota) setQuota(res.quota);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    flushSync(() => {
      setLoading(true);
      setError(null);
      setCompleted(null);
    });

    try {
      const accessToken = await getAccessToken();
      const anonymousId = getAnonymousId();
      const base = { accessToken, anonymousId };

      const endpoint = tab === "url" ? "/api/analyze/url" : "/api/analyze/text";
      const payload =
        tab === "url" ? { ...base, url: value.trim() } : { ...base, text: value.trim() };

      const result = await postJson<{
        requestId: string;
        submissionId: string;
        status: "completed" | "failed" | "processing";
        quota?: QuotaInfo;
        kvConfigured?: boolean;
        failedMessage?: string;
        report?: ReturnType<typeof analysisReportToManualReport>;
        platformReport?: AnalysisReport;
        finalIntelligence?: FinalIntelligenceSummary;
        explainability?: unknown;
        finalAnalysis?: import("@/lib/final-analysis-report").FinalAnalysisReport;
        analysisSnapshot?: {
          report: AnalysisReport;
          reliability?: unknown;
          finalIntelligence?: FinalIntelligenceSummary;
          submission?: unknown;
        };
        error?: { code?: string; message?: string; quota?: QuotaInfo };
      }>(endpoint, payload);

      if (!result.success) {
        if (result.quota) setQuota(result.quota);
        setError(userFacingAnalysisError(result.error, result.details, result.code));
        return;
      }

      if (result.quota) setQuota(result.quota);

      const requestId = result.requestId;
      if (!requestId) {
        setError("No request id returned from server");
        return;
      }

      if (result.status === "failed") {
        setError(result.failedMessage ?? "Analysis failed");
        return;
      }

      if (result.status === "processing") {
        setError(
          "Analysis is still running but no report was returned. Redeploy the latest build and enable FEED_KV, then retry.",
        );
        return;
      }

      if (result.analysisSnapshot && typeof window !== "undefined") {
        sessionStorage.setItem(
          `oscar-manual-${requestId}`,
          JSON.stringify(result.analysisSnapshot),
        );
      }

      const done = snapshotFromResponse(requestId, result as Record<string, unknown>);
      if (done) {
        setCompleted(done);
        return;
      }

      setError(
        "Analysis completed but the report was missing from the server response. Check worker logs and GEMINI_API_KEY, then retry.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <ReportView
        report={completed.report}
        platformReport={completed.platformReport}
        explainability={completed.explainability}
        finalAnalysis={completed.finalAnalysis}
        finalIntelligence={completed.finalIntelligence}
      />
    );
  }

  return (
    <>
      <QuotaBanner quota={quota} />
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> {badge}
        </div>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground">
          Top 100 news refreshes every 8 hours with full Oscar cluster analysis (multi-model) for new
          articles only — that does not use your daily quota. Only Ask Oscar counts toward your limit.
        </p>
      </div>

      <form onSubmit={submit} className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex gap-1 rounded-lg border bg-secondary/40 p-1">
          {[
            { k: "url" as const, label: "URL", Icon: Link2 },
            { k: "text" as const, label: "Paste text", Icon: FileText },
          ].map(({ k, label, Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === k ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "url" ? (
          <input
            type="url"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://example.com/news/article"
            className="w-full rounded-md border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <textarea
            required
            minLength={80}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste full article text here…"
            rows={12}
            className="w-full resize-none rounded-md border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        {error && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            URL mode uses metadata and excerpts unless licensed. Paste text for full analysis.
          </p>
          <button
            type="submit"
            disabled={loading || quota?.remaining === 0}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running analysis…
              </>
            ) : (
              <>Run Oscar Analysis</>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
