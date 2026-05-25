import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FileText } from "lucide-react";
import type { ManualReport } from "@/lib/mock-data";
import type {
  AnalysisExplainabilityBundle,
  AnalysisReport,
  FinalIntelligenceSummary,
} from "@/types/news-platform";
import { FinalIntelligencePanel } from "@/features/explainability/final-intelligence-panel";
import { ConfidenceBar } from "@/components/confidence-bar";
import { StatTile } from "@/components/stat-tile";
import { ClaimPanel } from "@/features/claims/claim-panel";
import { VerdictBadge } from "@/features/claims/verdict-badge";
import { SourceBadge } from "@/features/sources/source-badge";
import { ArticleElevenScoresPanel } from "@/features/explainability/article-eleven-scores-panel";
import type { ArticleStoryScores } from "@/features/explainability/article-eleven-scores-panel";
import { articlePageScoresToExplainability } from "@/features/explainability/article-page-scores-utils";
import type { ArticlePageScores } from "@/types/article-page-scores";
import { ArticleWeightedScorePanel } from "@/features/explainability/article-weighted-score-panel";
import { ReliabilityScoresPanel } from "@/features/explainability/reliability-scores-panel";
import type { StoryConsensusReport, TransparencyExplainabilityBundle } from "@/types/news-platform";
import { TopicBadges } from "@/features/topics/topic-badges";
import { ClickableScore } from "@/features/explainability/clickable-score";
import { ScoreExplainabilitySheet } from "@/features/explainability/score-explainability-sheet";
import { useState } from "react";
import type { ScoreExplainability } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function ReportView({
  report,
  platformReport,
  explainability,
  finalIntelligence,
  hideTopBackLink = false,
  articlePageMode = false,
  storyScores = null,
  storyReport = null,
}: {
  report: ManualReport;
  platformReport?: AnalysisReport;
  explainability?: AnalysisExplainabilityBundle | TransparencyExplainabilityBundle;
  finalIntelligence?: FinalIntelligenceSummary;
  hideTopBackLink?: boolean;
  /** Feed article pages: show all 11 score tiles + full breakdown. */
  articlePageMode?: boolean;
  storyScores?: ArticleStoryScores | null;
  storyReport?: StoryConsensusReport | null;
}) {
  const [claimExplainOpen, setClaimExplainOpen] = useState(false);
  const [claimExplain, setClaimExplain] = useState<ScoreExplainability | null>(null);

  const counts = report.claims.reduce<Record<string, number>>(
    (a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a),
    {},
  );

  const openClaimConfidence = () => {
    if (!articleExplainability) return;
    setClaimExplain({
      ...articleExplainability,
      entityLabel: "Claim verification confidence",
      whyScoreExists:
        `Overall verification confidence (${report.overallConfidence}%) is the mean confidence across extracted claims — distinct from article reliability (${explainability.article.overallScore}/100).`,
      howCalculated:
        "Each claim receives a confidence score from evidence strength, source agreement, and verdict classification.",
      overallScore: report.overallConfidence,
    });
    setClaimExplainOpen(true);
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {!hideTopBackLink && (
        <Link
          to="/analyze"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> New analysis
        </Link>
      )}

      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4",
          !hideTopBackLink && "mt-4",
        )}
      >
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{OSCAR.analysis} report</div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{report.title}</h1>
          <a href={report.url} className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
            <FileText className="h-3 w-3" /> {report.url}
          </a>
          {platformReport?.topicClassification && (
            <TopicBadges
              classification={platformReport.topicClassification}
              className="mt-3"
            />
          )}
        </div>
        <button className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">
          <Download className="h-4 w-4" /> Export report
        </button>
      </div>

      {articlePageMode && (articleExplainability || articlePageScores) && (
        <div className="mt-8 space-y-8">
          <ArticleElevenScoresPanel
            articleExplainability={articleExplainability}
            articlePageScores={articlePageScores}
            articleTitle={report.title}
            storyExplainability={
              explainability && "story" in explainability && explainability.story
                ? explainability.story
                : null
            }
            storyScores={effectiveStoryScores}
            storyReport={storyReport}
          />
          {articleExplainability ? (
            <>
              <ArticleWeightedScorePanel
                explainability={articleExplainability}
                verificationConfidence={report.overallConfidence}
              />
              {explainability ? (
                <ReliabilityScoresPanel explainability={explainability} hideArticle />
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {explainability && !articlePageMode && (
        <div className="mt-8 space-y-8">
          <ArticleWeightedScorePanel
            explainability={explainability.article}
            verificationConfidence={report.overallConfidence}
          />
          <ReliabilityScoresPanel explainability={explainability} hideArticle />
        </div>
      )}

      {finalIntelligence && (
        <div className="mt-8">
          <FinalIntelligencePanel scores={finalIntelligence} />
        </div>
      )}

      {!articlePageMode && (
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {explainability ? (
            <ClickableScore
              score={report.overallConfidence}
              label="Verification confidence"
              sublabel="Mean claim confidence"
              onClick={openClaimConfidence}
              className="sm:col-span-1"
            />
          ) : (
            <StatTile label="Overall confidence" value={`${report.overallConfidence}%`} />
          )}
          <StatTile label="Claims" value={report.claims.length} />
          <StatTile label="Supported" value={counts.supported ?? 0} />
          <StatTile
            label="Unclear / Insufficient"
            value={(counts.unclear ?? 0) + (counts.insufficient_evidence ?? 0)}
          />
        </div>
      )}

      {articlePageMode && (
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <StatTile label="Verification confidence" value={`${report.overallConfidence}%`} />
          <StatTile label="Claims" value={report.claims.length} />
          <StatTile label="Supported" value={counts.supported ?? 0} />
          <StatTile
            label="Unclear / Insufficient"
            value={(counts.unclear ?? 0) + (counts.insufficient_evidence ?? 0)}
          />
        </div>
      )}

      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">Executive summary</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{report.summary}</p>
        <div className="mt-4 max-w-md">
          {explainability ? (
            <button
              type="button"
              className="w-full text-left"
              onClick={openClaimConfidence}
            >
              <ConfidenceBar value={report.overallConfidence} label="Overall confidence (click for explanation)" />
            </button>
          ) : (
            <ConfidenceBar value={report.overallConfidence} label="Overall confidence" />
          )}
        </div>
      </div>

      {platformReport?.issueSummary && (
        <div className="mt-8 rounded-xl border bg-secondary/20 p-6">
          <h2 className="font-serif text-xl font-semibold">Issue signals</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4 text-sm">
            <div>
              <span className="text-muted-foreground">Contradictions</span>
              <p className="font-mono text-lg font-semibold">{platformReport.issueSummary.contradictions}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Missing context</span>
              <p className="font-mono text-lg font-semibold">{platformReport.issueSummary.missingContext}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Emotional language</span>
              <p className="font-mono text-lg font-semibold">{platformReport.issueSummary.emotionalLanguage}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Insufficient evidence</span>
              <p className="font-mono text-lg font-semibold">{platformReport.issueSummary.unsupportedClaims}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Extracted claims</h2>
          <div className="mt-4 space-y-3">
            {report.claims.map((c, i) => (
              <ClaimPanel key={c.id} claim={c} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-serif text-lg font-semibold">Cited sources</h3>
            <div className="flex flex-wrap gap-2">
              {report.sources.map((s) => <SourceBadge key={s.id} source={s} />)}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="mb-3 font-serif text-lg font-semibold">Verdict distribution</h3>
            <div className="space-y-2 text-sm">
              {(["supported", "disputed", "unclear", "insufficient_evidence"] as const).map((v) => (
                <div key={v} className="flex items-center justify-between">
                  <VerdictBadge verdict={v} />
                  <span className="font-mono text-sm">{counts[v] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
          {platformReport?.sourceComparisons && platformReport.sourceComparisons.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="mb-3 font-serif text-lg font-semibold">Cross-source comparisons</h3>
              <div className="space-y-3 text-sm">
                {platformReport.sourceComparisons.slice(0, 4).map((comp) => (
                  <div key={comp.claimId} className="rounded-md border bg-secondary/20 p-3">
                    <p className="text-xs font-medium leading-relaxed">{comp.claimText.slice(0, 100)}…</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Agreement: {comp.agreementScore}%
                      {(comp.contradictions?.length ?? 0) > 0 &&
                        ` · ${comp.contradictions!.length} contradiction(s)`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <ScoreExplainabilitySheet
        open={claimExplainOpen}
        onOpenChange={setClaimExplainOpen}
        explainability={claimExplain}
      />
    </main>
  );
}
