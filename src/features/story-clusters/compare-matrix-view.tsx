import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Cluster } from "@/lib/mock-data";
import { claimsForCluster, sourceById, storiesForCluster } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/confidence-bar";
import { SourceBadge } from "@/features/sources/source-badge";

export function CompareMatrixView({ cluster }: { cluster: Cluster }) {
  const stories = storiesForCluster(cluster.id);
  const claims = claimsForCluster(cluster.id);
  const sources = stories.map((s) => sourceById(s.sourceId));

  const matrix = claims.map((claim) =>
    sources.map((_, i) => {
      const e = claim.evidence[i % claim.evidence.length];
      return e?.supports ? "yes" : i % 3 === 0 ? "no" : "absent";
    }),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link
        to="/stories/$clusterId"
        params={{ clusterId: cluster.id }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to cluster
      </Link>
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Source comparison</div>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{cluster.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          How each approved source covers the underlying claims. Green = supports, red = contradicts, dim = not mentioned.
        </p>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/40">
              <th className="sticky left-0 z-10 min-w-[280px] bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Claim
              </th>
              {sources.map((s, i) => (
                <th key={`${s.id}-${i}`} className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <SourceBadge source={s} small />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {claims.map((c, i) => (
              <tr key={c.id}>
                <td className="sticky left-0 z-10 bg-card px-4 py-3">
                  <Link to="/claims/$claimId" params={{ claimId: c.id }} className="font-medium hover:underline">
                    {c.text}
                  </Link>
                  <div className="mt-2 max-w-xs">
                    <ConfidenceBar value={c.confidence} label="" />
                  </div>
                </td>
                {matrix[i].map((m, j) => (
                  <td key={j} className="px-3 py-3 text-center">
                    {m === "yes" && <Check className="mx-auto h-4 w-4 text-success" />}
                    {m === "no" && <X className="mx-auto h-4 w-4 text-destructive" />}
                    {m === "absent" && <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
