import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, GitCompare } from "lucide-react";
import type { Cluster } from "@/lib/mock-data";
import { claimsForCluster, sourceById, storiesForCluster } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/confidence-bar";
import { OSCAR } from "@/lib/brand";
import { StatTile } from "@/components/stat-tile";
import { ClaimPanel } from "@/features/claims/claim-panel";
import { SourceBadge } from "@/features/sources/source-badge";

export function ClusterView({ cluster }: { cluster: Cluster }) {
  const stories = storiesForCluster(cluster.id);
  const claims = claimsForCluster(cluster.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/stories" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All Top 100
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {cluster.category} · cluster {cluster.id}
          </div>
          <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight tracking-tight">{cluster.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{cluster.summary}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatTile label="Confidence" value={`${cluster.confidence}%`} />
            <StatTile label="Sources" value={cluster.storyCount} />
            <StatTile label="Disputed" value={cluster.disputedClaims} />
          </div>

          <h2 className="mt-12 font-serif text-2xl font-semibold">Claim breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each claim is cross-referenced across approved sources. Expand to see supporting and contradicting evidence.
          </p>
          <div className="mt-5 space-y-3">
            {claims.map((c, i) => (
              <ClaimPanel key={c.id} claim={c} defaultOpen={i === 0} />
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold">Coverage</h3>
              <div className="flex gap-3">
                <Link
                  to="/consensus/$clusterId"
                  params={{ clusterId: cluster.id }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {OSCAR.consensus}
                </Link>
                <Link
                  to="/compare/$clusterId"
                  params={{ clusterId: cluster.id }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  <GitCompare className="h-3 w-3" /> Compare
                </Link>
              </div>
            </div>
            <div className="space-y-2">
              {stories.map((s) => {
                const src = sourceById(s.sourceId);
                return (
                  <a key={s.id} href={s.url} className="block rounded-md border bg-background p-3 hover:bg-secondary/40">
                    <div className="flex items-center justify-between">
                      <SourceBadge source={src} small />
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-snug text-foreground/80">{s.summary}</p>
                  </a>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-serif text-lg font-semibold">Overall confidence</h3>
            <ConfidenceBar value={cluster.confidence} label="Cross-source agreement" />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Disputed claims</div>
                <div className="mt-0.5 font-serif text-xl font-semibold">{cluster.disputedClaims}</div>
              </div>
              <div className="rounded-md border bg-background p-2">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Missing context</div>
                <div className="mt-0.5 font-serif text-xl font-semibold">{cluster.missingContext}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
