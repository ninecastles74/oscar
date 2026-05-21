import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { Claim } from "@/lib/mock-data";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatTile } from "@/components/stat-tile";
import { VerdictBadge } from "./verdict-badge";
import { EvidenceCard } from "./evidence-card";

export function ClaimDetailView({ claim }: { claim: Claim }) {
  const supporting = claim.evidence.filter((e) => e.supports);
  const contradicting = claim.evidence.filter((e) => !e.supports);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/stories" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={claim.verdict} />
          <span className="font-mono text-[11px] text-muted-foreground">{claim.id}</span>
        </div>
        <h1 className="mt-3 font-serif text-3xl font-semibold leading-snug tracking-tight">{claim.text}</h1>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Confidence" value={`${claim.confidence}%`} />
        <StatTile label="Supporting" value={supporting.length} />
        <StatTile label="Contradicting" value={contradicting.length} />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5">
        <ConfidenceBar value={claim.confidence} label="Aggregate confidence" />
      </div>

      {claim.context && (
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="font-serif text-lg font-semibold">Missing context</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">{claim.context}</p>
        </div>
      )}

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 font-serif text-xl font-semibold text-success">Supporting evidence</h2>
          <div className="space-y-3">
            {supporting.map((e) => <EvidenceCard key={e.id} evidence={e} />)}
            {supporting.length === 0 && <p className="text-sm text-muted-foreground">No supporting evidence.</p>}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-serif text-xl font-semibold text-destructive">Contradicting evidence</h2>
          <div className="space-y-3">
            {contradicting.map((e) => <EvidenceCard key={e.id} evidence={e} />)}
            {contradicting.length === 0 && <p className="text-sm text-muted-foreground">No contradicting evidence.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
