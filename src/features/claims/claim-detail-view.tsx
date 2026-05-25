import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Claim } from "@/lib/mock-data";
import type {
  AnalysisExplainabilityBundle,
  AnalysisReport,
  ClaimConsensusReport,
  ClaimResearchReport,
  ContradictionAnalysisReport,
  MultiModelClaimVerification,
  TopicClassification,
} from "@/types/news-platform";
import { ClaimPanel } from "./claim-panel";
import { ReliabilityScoresPanel } from "@/features/explainability/reliability-scores-panel";

type EnrichedClaim = Claim & {
  topicClassification?: TopicClassification;
  claimResearch?: ClaimResearchReport;
  contradictionAnalysis?: ContradictionAnalysisReport;
  multiModelVerification?: MultiModelClaimVerification;
  claimConsensus?: ClaimConsensusReport;
};

export function ClaimDetailView({
  claim,
  explainability,
  clusterId,
  usingLiveFeed = false,
}: {
  claim: EnrichedClaim;
  platformReport?: AnalysisReport;
  explainability?: AnalysisExplainabilityBundle;
  clusterId?: string;
  usingLiveFeed?: boolean;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {clusterId ? (
        <Link
          to="/consensus/$clusterId"
          params={{ clusterId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to consensus
        </Link>
      ) : (
        <Link
          to="/stories"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Top 100
        </Link>
      )}

      {usingLiveFeed && (
        <p className="mt-4 text-xs text-muted-foreground">Live feed claim · verification panels below</p>
      )}

      {explainability && (
        <div className="mt-6">
          <ReliabilityScoresPanel explainability={explainability} />
        </div>
      )}

      <div className="mt-8">
        <ClaimPanel claim={claim} defaultOpen />
      </div>
    </main>
  );
}
