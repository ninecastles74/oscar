import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, FileSearch, TrendingUp } from "lucide-react";
import type { Cluster } from "@/lib/mock-data/types";
import { SOURCES } from "@/lib/mock-data";
import { ArticleThumbnail } from "@/components/article-thumbnail";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatTile } from "@/components/stat-tile";
import { SourceBadge } from "@/features/sources/source-badge";
import { OSCAR } from "@/lib/brand";

export function DashboardView({
  clusters,
  usingLiveFeed = false,
  meta,
}: {
  clusters: Cluster[];
  usingLiveFeed?: boolean;
  meta?: { top100Count?: number; lastIngestAt?: string | null };
}) {
  const trending = [...clusters].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 6);
  const disputed = [...clusters].filter((c) => c.disputedClaims > 0).slice(0, 4);
  const avgConfidence =
    clusters.length > 0
      ? Math.round(clusters.reduce((a, c) => a + c.confidence, 0) / clusters.length)
      : 0;
  const totalDisputed = clusters.reduce((a, c) => a + c.disputedClaims, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {OSCAR.signals}
            {usingLiveFeed ? " · live Top 100" : " · fixtures"}
          </div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Newsroom overview</h1>
          {meta?.lastIngestAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last ingest {new Date(meta.lastIngestAt).toLocaleString()}
            </p>
          )}
        </div>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          <FileSearch className="h-4 w-4" /> {OSCAR.ask}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active clusters"
          value={meta?.top100Count ?? clusters.length}
          hint="Top 100 slots"
        />
        <StatTile label="Avg. confidence" value={`${avgConfidence}%`} hint="Across feed clusters" />
        <StatTile label="Disputed claim flags" value={totalDisputed} hint="Cross-source disputes" />
        <StatTile label="Sources in registry" value={SOURCES.length} hint="Approved outlets" />
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
                to="/consensus/$clusterId"
                params={{ clusterId: c.id }}
                className="flex items-start gap-4 p-4 transition-colors hover:bg-secondary/40"
              >
                <span className="mt-0.5 w-6 font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <ArticleThumbnail src={c.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
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
              {disputed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No disputed clusters in the current feed.</p>
              ) : (
                disputed.map((c) => (
                  <Link
                    key={c.id}
                    to="/consensus/$clusterId"
                    params={{ clusterId: c.id }}
                    className="block rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
                      <AlertTriangle className="h-3 w-3" /> {c.disputedClaims} disputed
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium">{c.title}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-serif text-xl font-semibold">Top sources</h2>
            <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
              {SOURCES.slice(0, 8).map((s) => (
                <SourceBadge key={s.id} source={s} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <TrendingUp className="h-5 w-5 text-accent" />
            <h3 className="mt-3 font-serif text-lg font-semibold">Cross-source agreement</h3>
            <p className="mt-1 text-xs text-muted-foreground">Median cluster confidence in current feed.</p>
            <div className="mt-4 font-serif text-4xl font-semibold tabular-nums">{avgConfidence}%</div>
          </div>
        </div>
      </div>
    </main>
  );
}
