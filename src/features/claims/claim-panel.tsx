import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { sourceById, type Claim } from "@/lib/mock-data";
import type {
  ClaimConsensusReport,
  ClaimResearchReport,
  ContradictionAnalysisReport,
  MultiModelClaimVerification,
  TopicClassification,
} from "@/types/news-platform";
import { ConsensusPanel } from "./consensus-panel";
import { ContradictionPanel } from "./contradiction-panel";
import { MultiModelPanel } from "./multi-model-panel";
import { TopicBadges } from "@/features/topics/topic-badges";
import { ClaimResearchPanel } from "./claim-research-panel";
import { ConfidenceBar } from "@/components/confidence-bar";
import { SourceBadge } from "@/features/sources/source-badge";
import { VerdictBadge } from "./verdict-badge";

export function ClaimPanel({
  claim,
  defaultOpen,
}: {
  claim: Claim & {
    topicClassification?: TopicClassification;
    claimResearch?: ClaimResearchReport;
    contradictionAnalysis?: ContradictionAnalysisReport;
    multiModelVerification?: MultiModelClaimVerification;
    claimConsensus?: ClaimConsensusReport;
  };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const supporting = claim.evidence.filter((e) => e.supports).length;
  const contradicting = claim.evidence.length - supporting;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={claim.verdict} />
            <span className="text-[11px] text-muted-foreground">
              {supporting} supporting · {contradicting} contradicting
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">{claim.text}</p>
          <TopicBadges classification={claim.topicClassification} />
          <div className="max-w-md">
            <ConfidenceBar value={claim.confidence} />
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-3 border-t bg-secondary/20 p-4">
          {claim.context && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-warning">
                <AlertTriangle className="h-3 w-3" /> Missing context
              </div>
              <p className="text-foreground/80">{claim.context}</p>
            </div>
          )}
          {claim.reasoning && (
            <p className="rounded-md border bg-card p-3 text-xs leading-relaxed text-foreground/85">
              {claim.reasoning}
            </p>
          )}
          {claim.claimConsensus && <ConsensusPanel consensus={claim.claimConsensus} />}
          {claim.multiModelVerification && (
            <MultiModelPanel verification={claim.multiModelVerification} />
          )}
          {claim.contradictionAnalysis && (
            <ContradictionPanel analysis={claim.contradictionAnalysis} />
          )}
          {claim.claimResearch && <ClaimResearchPanel research={claim.claimResearch} />}
          <div className="grid gap-2">
            {claim.evidence.map((e) => {
              const s = sourceById(e.sourceId);
              return (
                <div key={e.id} className="rounded-md border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <SourceBadge source={s} small />
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        e.supports ? "text-success" : "text-destructive",
                      )}
                    >
                      {e.supports ? "Supports" : "Contradicts"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">"{e.excerpt}"</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {e.citationLabel && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {e.citationLabel}
                      </span>
                    )}
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      Source link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            to="/claims/$claimId"
            params={{ claimId: claim.id }}
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            Full claim breakdown →
          </Link>
        </div>
      )}
    </div>
  );
}
