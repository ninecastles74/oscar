import { createFileRoute, notFound } from "@tanstack/react-router";
import { CLAIMS } from "@/lib/mock-data";
import { analysisReportToManualReport } from "@/lib/analysis-adapter";
import type { AnalysisExplainabilityBundle, AnalysisReport } from "@/types/news-platform";
import { ClaimDetailView } from "@/features/claims/claim-detail-view";
import { loadFeedClaimDetail } from "@/server/news/functions";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/claims/$claimId")({
  head: ({ params }) => ({ meta: [{ title: pageTitle(`Claim ${params.claimId}`) }] }),
  loader: async ({ params }) => {
    const live = await loadFeedClaimDetail({ data: { claimId: params.claimId } });
    if (live && "platformReport" in live && live.platformReport) {
      const manual = analysisReportToManualReport(live.platformReport);
      const mockClaim = manual.claims.find((c) => c.id === params.claimId);
      if (mockClaim) {
        return {
          claim: mockClaim,
          platformReport: live.platformReport as AnalysisReport,
          explainability: live.explainability as AnalysisExplainabilityBundle | undefined,
          clusterId: live.clusterId,
          usingLiveFeed: true,
        };
      }
    }

    const claim = CLAIMS[params.claimId];
    if (!claim) throw notFound();
    return { claim, usingLiveFeed: false };
  },
  component: ClaimRoute,
  notFoundComponent: () => <div className="p-12 text-center">Claim not found</div>,
});

function ClaimRoute() {
  const data = Route.useLoaderData();
  return (
    <ClaimDetailView
      claim={data.claim}
      platformReport={"platformReport" in data ? data.platformReport : undefined}
      explainability={"explainability" in data ? data.explainability : undefined}
      clusterId={"clusterId" in data ? data.clusterId : undefined}
      usingLiveFeed={data.usingLiveFeed}
    />
  );
}
