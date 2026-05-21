import type { EvidenceItem, OriginalSourceLikelihood, ReportingDependencyEdge } from "@/types/news-platform";
import { approvedSourceById } from "../analysis/sources";
import { WIRE_SOURCE_IDS } from "./config";
import { hasCitationLanguage } from "./config";

export function computeOriginalSourceLikelihood(
  evidence: EvidenceItem[],
  edges: ReportingDependencyEdge[],
  syndicatedSourceIds: Set<string>,
): OriginalSourceLikelihood[] {
  const citedAsUpstream = new Set(edges.map((e) => e.toSourceId));
  const citesUpstream = new Set(edges.map((e) => e.fromSourceId));
  const sourceIds = [...new Set(evidence.map((e) => e.sourceId))];

  return sourceIds
    .map((sourceId) => {
      const src = approvedSourceById(sourceId);
      const name = src?.name ?? evidence.find((e) => e.sourceId === sourceId)?.sourceName ?? sourceId;
      const items = evidence.filter((e) => e.sourceId === sourceId);
      const isWire = WIRE_SOURCE_IDS.has(sourceId);
      const syndicated = syndicatedSourceIds.has(sourceId);
      const citedByOthers = citedAsUpstream.has(sourceId);
      const citesOthers = items.some((e) => hasCitationLanguage(e.excerpt)) || citesUpstream.has(sourceId);

      let likelihood = src?.reliability ?? 50;
      let role: OriginalSourceLikelihood["role"] = "unknown";
      const rationaleParts: string[] = [];

      if (isWire && !citesOthers) {
        role = "wire_origin";
        likelihood = Math.min(98, likelihood + 25);
        rationaleParts.push("Wire service with no upstream citation in excerpt.");
      } else if (citedByOthers && !syndicated) {
        role = "cited_upstream";
        likelihood = Math.min(95, likelihood + 15);
        rationaleParts.push("Other outlets cite or propagate this source.");
      } else if (!citesOthers && !syndicated && items.length > 0) {
        role = "first_reporter";
        likelihood = Math.min(92, likelihood + 10);
        rationaleParts.push("No detected upstream citation; distinct reporting path.");
      } else if (syndicated) {
        role = "syndicated_repeat";
        likelihood = Math.max(8, likelihood - 35);
        rationaleParts.push("Excerpt overlaps syndicated or wire-repeat pattern.");
      } else if (citesOthers) {
        role = "cited_upstream";
        likelihood = Math.max(15, likelihood - 20);
        rationaleParts.push("Downstream outlet citing upstream reporting.");
      }

      if (items.every((e) => e.stance === "contradict" || !e.supports)) {
        likelihood = Math.max(5, likelihood - 25);
        rationaleParts.push("Does not support the claim.");
      }

      return {
        sourceId,
        sourceName: name,
        likelihood: Math.round(Math.min(100, Math.max(0, likelihood))),
        role,
        rationale: rationaleParts.join(" ") || "Insufficient signals for origin ranking.",
      };
    })
    .sort((a, b) => b.likelihood - a.likelihood);
}
