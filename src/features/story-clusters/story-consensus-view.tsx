import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, HelpCircle, X } from "lucide-react";
import type { StoryConsensusReport, SourceAgreementStance } from "@/types/news-platform";
import { buildConsensusFindingsSummary } from "@/lib/consensus-findings-summary";
import { ConfidenceBar } from "@/components/confidence-bar";
import { OSCAR } from "@/lib/brand";
import { StatTile } from "@/components/stat-tile";
import { SourceBadge } from "@/features/sources/source-badge";
import { sourceById } from "@/lib/mock-data";

function StanceIcon({ stance }: { stance: SourceAgreementStance }) {
  if (stance === "support") return <Check className="mx-auto h-4 w-4 text-success" />;
  if (stance === "dispute") return <X className="mx-auto h-4 w-4 text-destructive" />;
  if (stance === "omitted") return <AlertTriangle className="mx-auto h-4 w-4 text-warning" />;
  if (stance === "neutral") return <HelpCircle className="mx-auto h-4 w-4 text-muted-foreground" />;
  return <span className="text-muted-foreground">—</span>;
}

export function StoryConsensusView({ report }: { report: StoryConsensusReport }) {
  const { sourceAgreementMap: map } = report;
  const singleSource = report.sourceCount <= 1 || report.articleCount <= 1;
  const findingsSummary =
    report.findingsSummary?.trim() || buildConsensusFindingsSummary(report);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <Link
        to="/stories"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Top 100
      </Link>

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {OSCAR.consensus}
        </div>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{report.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {report.articleCount} articles · {report.sourceCount} sources · computed{" "}
          {new Date(report.computedAt).toLocaleString()}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`${OSCAR.consensus} score`} value={`${report.consensusScore}%`} />
        <StatTile label="Dispute score" value={`${report.disputeScore}%`} />
        <StatTile label="Uncertainty score" value={`${report.uncertaintyScore}%`} />
        <StatTile label="Story confidence" value={`${report.storyConfidence}%`} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-serif text-xl font-semibold">Score breakdown</h2>
          <div className="mt-4 space-y-4">
            <ConfidenceBar
              value={report.consensusScore}
              label={
                singleSource
                  ? `${OSCAR.consensus} (claim agreement vs. evidence)`
                  : `${OSCAR.consensus} (cross-source agreement)`
              }
            />
            <ConfidenceBar value={100 - report.disputeScore} label="Agreement (inverse of dispute)" />
            <ConfidenceBar
              value={100 - report.uncertaintyScore}
              label="Clarity (inverse of uncertainty)"
            />
            <ConfidenceBar value={report.storyConfidence} label="Overall story confidence" />
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-serif text-xl font-semibold">
            {singleSource ? "Analyzed claims" : "Overlapping claims"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {singleSource
              ? "Claims extracted from this article and checked against reference sources"
              : "Claims multiple outlets report on the same event"}
          </p>
          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto text-sm">
            {report.overlappingClaims.length === 0 ? (
              <li className="text-muted-foreground">
                {singleSource ? "No claims extracted from this article." : "No multi-source overlap detected."}
              </li>
            ) : (
              report.overlappingClaims.map((c) => (
                <li key={c.groupId} className="rounded-md border bg-secondary/20 p-3">
                  <p className="font-medium">{c.canonicalText.slice(0, 160)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.sourceIds.length} sources · {c.agreementScore}% agreement
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">Source agreement map</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Green = supports · Red = disputes · ? = unclear · — = not mentioned · ⚠ = omitted context
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/40">
                <th className="sticky left-0 z-10 min-w-[240px] bg-secondary/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Claim
                </th>
                {map.sources.map((s) => (
                  <th key={s.articleId} className="px-3 py-3 text-center">
                    <Link
                      to="/stories/$clusterId/$articleId"
                      params={{ clusterId: report.clusterId, articleId: s.articleId }}
                      className="inline-flex flex-col items-center gap-1 hover:opacity-80"
                      title={`Open ${OSCAR.analysis} for this article`}
                    >
                      <SourceBadge
                        source={
                          sourceById(s.sourceId) ?? {
                            id: s.sourceId,
                            name: s.sourceName,
                            domain: s.sourceDomain,
                            bias: "center",
                            reliability: 70,
                            approved: true,
                          }
                        }
                        small
                      />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {map.claimGroups.map((g) => (
                <tr key={g.groupId}>
                  <td className="sticky left-0 z-10 bg-card px-4 py-3 text-xs font-medium">
                    {g.canonicalText.slice(0, 120)}
                    {g.canonicalText.length > 120 ? "…" : ""}
                  </td>
                  {map.sources.map((s) => {
                    const cell = map.cells.find(
                      (c) => c.groupId === g.groupId && c.articleId === s.articleId,
                    );
                    return (
                      <td key={s.articleId} className="px-3 py-3 text-center">
                        <StanceIcon stance={cell?.stance ?? "absent"} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-destructive">Disputed claims</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {report.disputedClaims.length === 0 ? (
              <li className="text-muted-foreground">No cross-source disputes flagged.</li>
            ) : (
              report.disputedClaims.map((d) => (
                <li key={d.groupId} className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="font-medium">{d.canonicalText.slice(0, 140)}</p>
                  <p className="mt-1 text-xs">{d.description}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold text-warning">Omitted context</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {report.omittedContext.length === 0 ? (
              <li className="text-muted-foreground">No major context gaps across outlets.</li>
            ) : (
              report.omittedContext.slice(0, 8).map((o, i) => (
                <li key={i} className="rounded-md border border-warning/30 bg-warning/5 p-3">
                  <p className="font-medium">{o.claimText.slice(0, 100)}</p>
                  <p className="mt-1 text-xs text-foreground/80">{o.description}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Emotional framing differences</h2>
          {report.emotionalFramingDifferences.map((f, i) => (
            <div key={i} className="mt-3 text-sm">
              <p className="font-medium">{f.aspect}</p>
              <p className="mt-1 text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-serif text-lg font-semibold">Narrative differences</h2>
          {report.narrativeDifferences.map((n, i) => (
            <div key={i} className="mt-3 text-sm">
              <p className="font-medium">{n.aspect}</p>
              <p className="mt-1 text-muted-foreground">{n.description}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="mt-10 rounded-xl border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">Consensus findings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Overall read on agreement, dispute, and context across sources
        </p>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-foreground/90">
          {findingsSummary}
        </p>
      </section>
    </main>
  );
}
