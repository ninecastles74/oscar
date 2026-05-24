import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Link2, Loader2, Sparkles } from "lucide-react";
import {
  submitManualAnalysis,
  submitPersonalWritingAnalysis,
} from "@/server/analysis/functions";
import { getAiUsageQuota } from "@/server/usage/functions";
import { getAccessToken } from "@/lib/auth-session";
import { getAnonymousId } from "@/lib/anonymous-id";
import { QuotaBanner, type QuotaInfo } from "./quota-banner";

export type UserAnalysisMode = "article" | "writing";

export function UserAnalysisForm({
  mode,
  badge,
  title,
  description,
}: {
  mode: UserAnalysisMode;
  badge: string;
  title: string;
  description: string;
}) {
  const nav = useNavigate();
  const personal = mode === "writing";
  const [tab, setTab] = useState<"url" | "text">(personal ? "text" : "url");
  const [value, setValue] = useState("");
  const [writingTitle, setWritingTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

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
    setLoading(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const anonymousId = getAnonymousId();
      const base = { accessToken, anonymousId };

      const result = personal
        ? await submitPersonalWritingAnalysis({
            data: {
              ...base,
              text: value.trim(),
              title: writingTitle.trim() || undefined,
            },
          })
        : await submitManualAnalysis({
            data:
              tab === "url"
                ? { ...base, url: value.trim(), kind: "manual_article" }
                : { ...base, text: value.trim(), kind: "manual_article" },
          });

      if ("error" in result && result.error) {
        setError(result.error.message);
        if ("quota" in result.error && result.error.quota) {
          setQuota(result.error.quota as QuotaInfo);
        }
        setLoading(false);
        return;
      }

      if (result.quota) setQuota(result.quota);

      if (!result.requestId) {
        setError("No request id returned from server");
        setLoading(false);
        return;
      }

      await nav({
        to: "/analyze/results",
        search: { id: result.requestId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setLoading(false);
    }
  };

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
          articles only — that does not use your daily quota. Only Ask Oscar and My Writing count toward your limit.
        </p>
      </div>

      <form onSubmit={submit} className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
        {!personal && (
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
        )}

        {personal && (
          <input
            type="text"
            value={writingTitle}
            onChange={(e) => setWritingTitle(e.target.value)}
            placeholder="Title of your piece (optional)"
            className="mb-4 w-full rounded-md border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        )}

        {!personal && tab === "url" ? (
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
            placeholder={
              personal
                ? "Paste your essay, op-ed, or draft here (min. 80 characters)…"
                : "Paste full article text here…"
            }
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
            {personal
              ? "Your writing is analyzed privately and counts toward your daily Oscar quota."
              : "URL mode uses metadata and excerpts unless licensed. Paste text for full analysis."}
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
