import type { ReactNode } from "react";
import type { ContradictionAnalysisReport } from "@/types/news-platform";
import { OSCAR } from "@/lib/brand";
import { AlertTriangle, Clock, GitCompare, HelpCircle, Link2 } from "lucide-react";

export function ContradictionPanel({ analysis }: { analysis: ContradictionAnalysisReport }) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div>
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {OSCAR.contradiction}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">{analysis.analysisSummary}</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          Risk score: {analysis.contradictionScore}/100
        </p>
      </div>

      {analysis.claimEvidenceConflicts.length > 0 && (
        <IssueSection icon={Link2} title="Claim vs evidence">
          {analysis.claimEvidenceConflicts.map((c) => (
            <p key={c.claimId + c.description} className="text-xs text-muted-foreground">
              {c.description}
            </p>
          ))}
        </IssueSection>
      )}

      {analysis.conflictingReporting.length > 0 && (
        <IssueSection icon={GitCompare} title="Conflicting reporting">
          {analysis.conflictingReporting.map((c, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {c.description}
            </p>
          ))}
        </IssueSection>
      )}

      {analysis.articleDifferences.length > 0 && (
        <IssueSection icon={GitCompare} title="Article differences">
          {analysis.articleDifferences.slice(0, 3).map((d, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {d.sourceAName} vs {d.sourceBName}: {d.description}
            </p>
          ))}
        </IssueSection>
      )}

      {analysis.omittedContext.length > 0 && (
        <IssueSection icon={HelpCircle} title="Omitted context">
          {analysis.omittedContext.map((o, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {o.description}
            </p>
          ))}
        </IssueSection>
      )}

      {analysis.timelineInconsistencies.length > 0 && (
        <IssueSection icon={Clock} title="Timeline inconsistencies">
          {analysis.timelineInconsistencies.map((t, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {t.description}
            </p>
          ))}
        </IssueSection>
      )}

      {analysis.unsupportedCausalClaims.length > 0 && (
        <IssueSection icon={AlertTriangle} title="Unsupported causal claims">
          {analysis.unsupportedCausalClaims.map((u, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {u.description}
            </p>
          ))}
        </IssueSection>
      )}
    </div>
  );
}

function IssueSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof AlertTriangle;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}
