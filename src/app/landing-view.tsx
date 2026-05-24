import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Layers, Quote, Scan, ShieldCheck } from "lucide-react";
import { OscarLogo } from "@/components/oscar-logo";
import { BRAND_NAME, OSCAR } from "@/lib/brand";

export function LandingView() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 grain opacity-60" />
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28">
          <div className="grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <OscarLogo size="hero" priority className="mb-8" />
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> {OSCAR.intelligence} · Live
              </div>
              <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
                Read the news. <br />
                <span className="text-muted-foreground">Trust the signals.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {BRAND_NAME} pulls the world&apos;s top stories, clusters duplicates, and runs{" "}
                {OSCAR.analysis.toLowerCase()} against approved sources — surfacing confidence,
                dispute, and missing context for every story.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                >
                  {OSCAR.signals} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/analyze"
                  className="inline-flex items-center gap-2 rounded-md border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
                >
                  {OSCAR.ask}
                </Link>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>{OSCAR.consensus}</span>
                <span className="font-mono">cluster #c1</span>
              </div>
              <h3 className="mt-3 font-serif text-xl font-semibold leading-snug">
                Central banks signal coordinated pause on rate hikes
              </h3>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Cross-source agreement", v: 87, c: "bg-success" },
                  { label: "Disputed claims", v: 12, c: "bg-warning" },
                  { label: "Missing context flags", v: 8, c: "bg-destructive" },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{r.label}</span>
                      <span className="font-mono tabular-nums text-foreground">{r.v}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${r.c}`} style={{ width: `${r.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t pt-4">
                {["Reuters", "AP", "BBC", "FT", "Bloomberg", "+7"].map((s) => (
                  <span key={s} className="rounded-md border bg-background px-2 py-1 text-[11px] font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two modes */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Two modes</div>
          <h2 className="mt-2 font-serif text-4xl font-semibold tracking-tight">One platform. Two ways to verify.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/stories" className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-md">
            <Activity className="h-7 w-7 text-accent" />
            <h3 className="mt-5 font-serif text-2xl font-semibold">{OSCAR.monitor}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Continuously ingests the top 100 stories from major APIs, RSS, and approved publishers.
              Duplicates are clustered, claims extracted, and cross-referenced in real time.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Cross-source clustering", "Per-story confidence", "Disputed claim alerts", "Missing context detection"].map((x) => (
                <li key={x} className="flex items-center gap-2 text-foreground/80">
                  <span className="h-1 w-1 rounded-full bg-foreground" /> {x}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:underline">
              View Top 100 <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <Link to="/analyze" className="group rounded-2xl border bg-card p-8 transition-all hover:shadow-md">
            <Scan className="h-7 w-7 text-accent" />
            <h3 className="mt-5 font-serif text-2xl font-semibold">{OSCAR.ask}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Paste a URL or article text. {BRAND_NAME} extracts claims, gathers evidence from approved
              sources, and delivers a full {OSCAR.analysis.toLowerCase()} report with citations and scores.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Claim extraction", "Evidence with citations", "Bias & source comparison", "Exportable report"].map((x) => (
                <li key={x} className="flex items-center gap-2 text-foreground/80">
                  <span className="h-1 w-1 rounded-full bg-foreground" /> {x}
                </li>
              ))}
            </ul>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:underline">
              {OSCAR.ask} <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t bg-secondary/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              { Icon: Layers, t: "Cluster, don't duplicate", d: "Stories about the same event are merged into a single cluster with shared claims and source comparison." },
              { Icon: ShieldCheck, t: OSCAR.verified, d: "Every claim links to specific excerpts and URLs. Reliability and bias are visible per source." },
              { Icon: Quote, t: "Context, not just verdicts", d: "Confidence bars show how much evidence backs a claim — and flag what's missing from the framing." },
            ].map(({ Icon, t, d }) => (
              <div key={t}>
                <Icon className="h-5 w-5" />
                <h3 className="mt-4 font-serif text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
