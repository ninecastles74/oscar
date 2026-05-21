import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Link2, Loader2, Sparkles } from "lucide-react";
import { submitManualAnalysis } from "@/server/analysis/functions";

export function AnalyzerFormView() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"url" | "text">("url");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = tab === "url" ? { url: value.trim() } : { text: value.trim() };

      const result = await submitManualAnalysis({ data: payload });

      if ("error" in result && result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Manual analyzer
        </div>
        <h1 className="mt-4 font-serif text-5xl font-semibold tracking-tight">
          Analyze any article
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Paste a URL or the full article text. Veridict will extract claims, gather evidence from
          approved sources, and return a full verification report.
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
            rows={10}
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
            URL mode uses metadata and short excerpts only unless licensed. Paste text to analyze
            the full article.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>Run analysis</>
            )}
          </button>
        </div>
      </form>

      <div className="mt-10 grid grid-cols-3 gap-3 text-center">
        {[
          { v: "~12s", l: "avg. analysis" },
          { v: "12", l: "approved sources" },
          { v: "6–10", l: "claims extracted" },
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
