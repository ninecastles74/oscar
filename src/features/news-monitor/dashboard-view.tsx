import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, FileSearch, TrendingUp } from "lucide-react";
import { CLUSTERS, SOURCES } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatTile } from "@/components/stat-tile";
import { SourceBadge } from "@/features/sources/source-badge";
import { OSCAR } from "@/lib/brand";

export function DashboardView() {
  const trending = [...CLUSTERS].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 6);
  const disputed = [...CLUSTERS].filter((c) => c.disputedClaims > 1).slice(0, 4);
  const avgConfidence = Math.round(CLUSTERS.reduce((a, c) => a + c.confidence, 0) / CLUSTERS.length);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{OSCAR.signals}</div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Newsroom overview</h1>
        </div>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <FileSearch className="h-4 w-4" /> {OSCAR.ask}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Stories analyzed (24h)" value="12,418" hint="+8.2% vs yesterday" />
        <StatTile label="Active clusters" value={CLUSTERS.length} hint="Top 100 view" />
        <StatTile label="Avg. confidence" value={`${avgConfidence}%`} hint="Across all claims" />
        <StatTile
          label="Disputed claims"
          value={CLUSTERS.reduce((a, c) => a + c.disputedClaims, 0)}
          hint="Flagged in last 24h"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">Trending clusters</h2>
            <Link to="/stories" className="text-xs font-semibold text-accent hover:underline">
              View all Top 100 →
            </Link>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {trending.map((c, i) => (
              <Link
                key={c.id}
                to="/stories/$clusterId"
                params={{ clusterId: c.id }}
                className="flex items-start gap-4 p-4 transition-colors hover:bg-secondary/40"
              >
                <span className="mt-0.5 w-6 font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span>{c.category}</span>
                    <span>·</span>
                    <span>{c.storyCount} sources</span>
                    {c.disputedClaims > 0 && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3 w-3" /> {c.disputedClaims} disputed
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold leading-snug">{c.title}</h3>
                  <div className="mt-2 max-w-xs">
                    <ConfidenceBar value={c.confidence} />
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-serif text-xl font-semibold">Disputed now</h2>
            <div className="space-y-2">
              {disputed.map((c) => (
                <Link
                  key={c.id}
                  to="/stories/$clusterId"
                  params={{ clusterId: c.id }}
                  className="block rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
                    <AlertTriangle className="h-3 w-3" /> {c.disputedClaims} disputed
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{c.title}</p>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-serif text-xl font-semibold">Top sources</h2>
            <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
              {SOURCES.slice(0, 8).map((s) => <SourceBadge key={s.id} source={s} />)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h3 className="mt-3 font-serif text-lg font-semibold">Cross-source agreement</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Median claim agreement across the top 30 clusters this hour.
            </p>
            <div className="mt-4 font-serif text-4xl font-semibold tabular-nums">81%</div>
          </div>
        </div>
      </div>
    </main>
  );
}
