import { ExternalLink, History, Scale, Sparkles } from "lucide-react";
import type { ScoreExplainability } from "@/types/news-platform";
import { ConfidenceBar } from "@/components/confidence-bar";
import { OSCAR } from "@/lib/brand";
import { cn } from "@/lib/utils";

function EvidenceList({
  title,
  items,
  emptyMessage,
  tone,
}: {
  title: string;
  items: ScoreExplainability["supportingEvidence"];
  emptyMessage: string;
  tone: "support" | "dispute";
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {items.map((e) => (
            <div
              key={e.id}
              className={cn(
                "rounded-md border p-3 text-sm",
                tone === "support"
                  ? "border-success/20 bg-success/5"
                  : "border-destructive/20 bg-destructive/5",
              )}
            >
              <div className="text-xs font-semibold text-muted-foreground">
                {e.sourceName}
                {e.verdict ? ` · ${e.verdict}` : ""}
              </div>
              <p className="mt-1 text-xs leading-relaxed">{e.claimText}</p>
              <p className="mt-2 text-xs italic text-foreground/80">"{e.excerpt}"</p>
              {e.url ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                >
                  View source <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * On-page breakdown of this article's weighted reliability score (not org/author rolling averages).
 */
export function ArticleWeightedScorePanel({
  explainability,
  verificationConfidence,
}: {
  explainability: ScoreExplainability;
  /** Mean claim verification confidence — shown for contrast only. */
  verificationConfidence?: number;
}) {
  return (
    <section className="rounded-xl border border-accent/25 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {OSCAR.reliability}
          </div>
          <h2 className="mt-1 font-serif text-2xl font-semibold">Weighted article score</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            This is the reliability score for <span className="font-medium text-foreground">{explainability.entityLabel}</span>{" "}
            only — a weighted composite of six verification categories for this article. It is not the
            publisher or author rolling average shown on Oscar Sources.
          </p>
        </div>
        <div className="rounded-lg border bg-secondary/30 px-6 py-4 text-center">
          <div className="font-mono text-4xl font-semibold tabular-nums">
            {explainability.overallScore}
          </div>
          <div className="text-xs text-muted-foreground">out of 100</div>
        </div>
      </div>

      {verificationConfidence != null && (
        <p className="mt-4 rounded-md border bg-secondary/20 px-4 py-3 text-sm text-foreground/90">
          <span className="font-medium">Verification confidence ({verificationConfidence}%)</span> is
          separate: it is the mean confidence across extracted claims. The weighted article score above
          combines category signals (evidence, corroboration, context, contradictions, sensationalism,
          transparency).
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{explainability.disclaimer}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-secondary/20 p-4">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Scale className="h-4 w-4" /> Why this score exists
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            {explainability.whyScoreExists}
          </p>
        </div>
        <div className="rounded-lg border bg-secondary/20 p-4">
          <h3 className="font-serif text-lg font-semibold">How it was calculated</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            {explainability.howCalculated}
          </p>
          <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
            {explainability.weightedFormula}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-serif text-lg font-semibold">Category breakdown (weights sum to 100%)</h3>
        <div className="mt-4 space-y-3">
          {explainability.calculationSteps.map((step) => (
            <div key={step.categoryId} className="rounded-md border bg-secondary/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{step.label}</span>
                <span className="font-mono text-sm tabular-nums">
                  {step.score}
                  <span className="text-muted-foreground"> × {step.weightPercent}%</span>
                </span>
              </div>
              <ConfidenceBar value={step.score} label={step.formulaSummary} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h3 className="font-serif text-lg font-semibold">Confidence & penalties</h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {explainability.confidenceExplanation}
        </p>
        {explainability.appliedPenalties ? (
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {explainability.appliedPenalties.contradictionPenalty > 0 && (
              <li>Contradiction penalty: −{explainability.appliedPenalties.contradictionPenalty}</li>
            )}
            {explainability.appliedPenalties.sensationalPenalty > 0 && (
              <li>Sensationalism penalty: −{explainability.appliedPenalties.sensationalPenalty}</li>
            )}
            {explainability.appliedPenalties.missingContextPenalty > 0 && (
              <li>Missing context penalty: −{explainability.appliedPenalties.missingContextPenalty}</li>
            )}
            {explainability.appliedPenalties.insufficientEvidencePenalty > 0 && (
              <li>
                Insufficient evidence penalty: −{explainability.appliedPenalties.insufficientEvidencePenalty}
              </li>
            )}
          </ul>
        ) : null}
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Sparkles className="h-4 w-4" /> AI reasoning summary
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {explainability.aiReasoningSummary}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <EvidenceList
          title="Supporting evidence"
          items={explainability.supportingEvidence}
          emptyMessage="No supporting citations recorded."
          tone="support"
        />
        <EvidenceList
          title="Disputed evidence"
          items={explainability.disputedEvidence}
          emptyMessage="No disputed citations recorded."
          tone="dispute"
        />
      </div>

      {explainability.corroboratingSources.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <h3 className="font-serif text-lg font-semibold">Corroborating sources</h3>
          <div className="mt-3 space-y-2">
            {explainability.corroboratingSources.map((s) => (
              <div key={s.sourceId} className="rounded-md border bg-secondary/20 p-3 text-sm">
                <div className="font-medium">{s.sourceName}</div>
                <div className="text-xs text-muted-foreground">
                  {s.supportingClaims} supporting report(s)
                  {s.agreementScore != null ? ` · ${s.agreementScore}% agreement` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {explainability.contradictionHistory.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <h3 className="font-serif text-lg font-semibold">Contradiction history</h3>
          <div className="mt-3 space-y-2">
            {explainability.contradictionHistory.map((c, i) => (
              <div
                key={i}
                className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm"
              >
                <div className="text-xs font-semibold uppercase text-destructive">
                  {c.severity} · {c.sourceNames.join(" vs ")}
                </div>
                <p className="mt-1 font-medium">{c.claimText}</p>
                <p className="mt-1 text-xs text-foreground/80">{c.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {explainability.omittedContext.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <h3 className="font-serif text-lg font-semibold">Omitted context</h3>
          <div className="mt-3 space-y-2">
            {explainability.omittedContext.map((o, i) => (
              <div key={i} className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                <p className="font-medium">{o.claimText}</p>
                <p className="mt-1 text-xs text-foreground/80">{o.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {explainability.historicalChanges.length > 0 && (
        <section className="mt-6 rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <History className="h-4 w-4" /> Historical scoring changes (this article)
          </h3>
          <div className="mt-3 space-y-2">
            {explainability.historicalChanges.map((h) => (
              <div key={h.version} className="flex gap-3 rounded-md border bg-secondary/20 p-3 text-sm">
                <div className="font-mono text-xs text-muted-foreground">v{h.version}</div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{h.overallScore}</span>
                    {h.delta !== null && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          h.delta > 0 ? "text-success" : h.delta < 0 ? "text-destructive" : "",
                        )}
                      >
                        {h.delta > 0 ? "+" : ""}
                        {h.delta}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.recordedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{h.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
