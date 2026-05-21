import { createFileRoute, notFound } from "@tanstack/react-router";
import { CLAIMS } from "@/lib/mock-data";
import { ClaimDetailView } from "@/features/claims/claim-detail-view";

export const Route = createFileRoute("/claims/$claimId")({
  head: ({ params }) => ({ meta: [{ title: `Claim ${params.claimId} — Veridict` }] }),
  loader: ({ params }) => {
    const claim = CLAIMS[params.claimId];
    if (!claim) throw notFound();
    return { claim };
  },
  component: ClaimRoute,
  notFoundComponent: () => <div className="p-12 text-center">Claim not found</div>,
});

function ClaimRoute() {
  const { claim } = Route.useLoaderData();
  return <ClaimDetailView claim={claim} />;
}
