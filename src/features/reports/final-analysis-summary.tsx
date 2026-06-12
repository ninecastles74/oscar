import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FinalAnalysisReport } from "@/lib/final-analysis-report";
import { ConfidenceBar } from "@/components/confidence-bar";
import { VerdictBadge } from "@/features/claims/verdict-badge";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/mock-data";

const LABEL_TO_VERDICT: Record<string, Verdict> = {
  Supported: "supported",
  Disputed: "disputed",
  Unclear: "unclear",
  "Insufficient Evidence": "insufficient_evidence",
};

function ScoreMeter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">{value}/100</span>
      </div>
      <ConfidenceBar value={value} label="" className="mt-2" />
      {hint ? <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ClaimCard({
  claim,
  index,
}: {
  claim: FinalAnalysisReport["claims"][number];
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  const verdict = LABEL_TO_VERDICT[claim.status] ?? "unclear";

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={verdict} />
            <span className="text-xs text-muted-foreground">
              Confidence {claim.confidenceScore}/100
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed">{claim.claimText}</p>
        </div>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t px-4 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {claim.plainEnglishExplanation}
          </p>
          {claim.supportingEvidence.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-success">
                Supporting evidence
              </h4>
              <ul className="mt-2 space-y-2">
                {claim.supportingEvidence.map((ev, i) => (
                  <li key={`${ev.source}-${i}`} className="rounded-md border bg-secondary/30 p-3 text-sm">
                    <div className="font-medium">{ev.source}</div>
                    <p className="mt-1 text-muted-foreground">{ev.excerpt}</p>
                    {ev.url ? (
                      <a href={ev.url} className="mt-1 inline-block text-xs text-accent hover:underline">
                        View source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {claim.disputingEvidence.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-warning">
                Disputing evidence
              </h4>
              <ul className="mt-2 space-y-2">
                {claim.disputingEvidence.map((ev, i) => (
                  <li key={`${ev.source}-${i}`} className="rounded-md border bg-secondary/30 p-3 text-sm">
                    <div className="font-medium">{ev.source}</div>
                    <p className="mt-1 text-muted-foreground">{ev.excerpt}</p>
                    {ev.url ? (
                      <a href={ev.url} className="mt-1 inline-block text-xs text-accent hover:underline">
                        View source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {claim.warnings.length > 0 ? (
            <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
              {claim.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FinalAnalysisSummary({ analysis }: { analysis: FinalAnalysisReport }) {
  const verdict = LABEL_TO_VERDICT[analysis.summary.finalLabel] ?? "unclear";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-gradient-to-br from-card to-secondary/30 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              OSCAR summary
            </p>
            <h2 className="font-serif text-2xl font-semibold">{analysis.article.title}</h2>
            <p className="text-xs text-muted-foreground">{analysis.article.source}</p>
            <VerdictBadge verdict={verdict} />
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {analysis.summary.shortExplanation}
            </p>
          </div>
          <div className="grid min-w-[220px] gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-background/80 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Evidence-weighted reliability
              </div>
              <div className="mt-1 font-serif text-3xl font-semibold">
                {analysis.summary.overallReliabilityScore}
              </div>
            </div>
            <div className="rounded-lg border bg-background/80 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Confidence
              </div>
              <div className="mt-1 font-serif text-3xl font-semibold">
                {analysis.summary.confidenceScore}
              </div>
            </div>
            <div className="rounded-lg border bg-background/80 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Uncertainty
              </div>
              <div className="mt-1 font-serif text-3xl font-semibold">
                {analysis.summary.uncertaintyLevel}
              </div>
            </div>
          </div>
        </div>
        {analysis.summary.importantWarning ? (
          <p
            className={cn(
              "mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm",
            )}
          >
            {analysis.summary.importantWarning}
          </p>
        ) : null}
        {analysis.metadata.reducedConfidence ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Live evidence retrieval was temporarily limited, so OSCAR lowered confidence for some
            claims.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Score breakdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Evidence-weighted signals — not a truth score.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreMeter
            label="Evidence support"
            value={analysis.scoreBreakdown.evidenceSupport}
            hint="Strength of direct quotes, data, and primary material."
          />
          <ScoreMeter
            label="Source independence"
            value={analysis.scoreBreakdown.sourceIndependence}
            hint="Whether separate outlets verify the claim independently."
          />
          <ScoreMeter
            label="Corroboration"
            value={analysis.scoreBreakdown.corroboration}
            hint="Agreement across distinct reporting chains."
          />
          <ScoreMeter
            label="Context completeness"
            value={analysis.scoreBreakdown.contextCompleteness}
            hint="Missing timeline, scope, or caveats reduce this score."
          />
          <ScoreMeter
            label="Contradiction risk"
            value={analysis.scoreBreakdown.contradictionRisk}
            hint="Higher when conflicting details appear across sources."
          />
          <ScoreMeter
            label="Narrative intensity"
            value={analysis.scoreBreakdown.narrativeIntensity}
            hint="Sensational or certainty-exaggerating language."
          />
          <ScoreMeter
            label="Source transparency"
            value={analysis.scoreBreakdown.sourceTransparency}
            hint="Named sources, citations, and clear attribution."
          />
        </div>
      </section>

      {analysis.claims.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Claims reviewed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each claim is assessed independently with supporting and disputing evidence.
          </p>
          <div className="mt-4 space-y-3">
            {analysis.claims.map((claim, i) => (
              <ClaimCard key={`${claim.claimText.slice(0, 40)}-${i}`} claim={claim} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Why this score?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {analysis.whyThisScore.plainEnglishSummary}
        </p>
        {analysis.whyThisScore.mainReasonsScoreIncreased.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-success">What increased reliability</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {analysis.whyThisScore.mainReasonsScoreIncreased.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.whyThisScore.mainReasonsScoreDecreased.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-warning">What reduced reliability</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {analysis.whyThisScore.mainReasonsScoreDecreased.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.whyThisScore.missingEvidence.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Missing evidence</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
              {analysis.whyThisScore.missingEvidence.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {analysis.whyThisScore.sourceIndependenceExplanation ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Source independence: </span>
            {analysis.whyThisScore.sourceIndependenceExplanation}
          </p>
        ) : null}
        {analysis.whyThisScore.contradictionExplanation ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Contradiction risk: </span>
            {analysis.whyThisScore.contradictionExplanation}
          </p>
        ) : null}
        {analysis.whyThisScore.narrativeExplanation ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Narrative framing: </span>
            {analysis.whyThisScore.narrativeExplanation}
          </p>
        ) : null}
      </section>
    </div>
  );
}
