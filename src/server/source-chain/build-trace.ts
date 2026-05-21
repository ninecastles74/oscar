import type { EvidenceItem, SourceChainTraceReport } from "@/types/news-platform";
import { approvedSourceById } from "../analysis/sources";
import { buildCitationChains, detectCitationEdges } from "./citation-chains";
import { detectCircularReporting } from "./circular-reporting";
import {
  buildReportingDependencyMap,
  independentSourceIdsFromEvidence,
} from "./dependency-map";
import { computeOriginalSourceLikelihood } from "./original-source";
import { countIndependentSources, detectSyndication } from "./syndication";
import { detectWirePropagation } from "./wire-propagation";

export interface SourceChainTraceInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
}

/**
 * Source-chain tracing engine — origin, citation chains, wire propagation,
 * circular reporting, and independent vs syndicated distinction.
 */
export function buildSourceChainTrace(input: SourceChainTraceInput): SourceChainTraceReport {
  const { claimId, claimText, evidence } = input;

  const citationEdges = detectCitationEdges(evidence);
  const { paths: wirePropagation, edges: wireEdges } = detectWirePropagation(evidence);
  const { edges: syndicationEdges, syndicatedSourceIds, groups: repeatedOriginalSourceGroups } =
    detectSyndication(evidence);

  const allEdges = [...citationEdges, ...wireEdges, ...syndicationEdges];
  const excerptsBySource = new Map<string, string[]>();
  for (const e of evidence) {
    const list = excerptsBySource.get(e.sourceId) ?? [];
    list.push(e.excerpt);
    excerptsBySource.set(e.sourceId, list);
  }

  const circularReporting = detectCircularReporting(allEdges, excerptsBySource);

  const originalSourceLikelihood = computeOriginalSourceLikelihood(
    evidence,
    allEdges,
    syndicatedSourceIds,
  );

  const independentIds = independentSourceIdsFromEvidence(evidence, syndicatedSourceIds);
  const independentSourceCount = countIndependentSources(
    evidence,
    syndicatedSourceIds,
    new Set(allEdges.map((e) => e.toSourceId)),
  );

  const nameById = new Map<string, string>();
  for (const e of evidence) {
    nameById.set(e.sourceId, e.sourceName ?? approvedSourceById(e.sourceId)?.name ?? e.sourceId);
  }
  const citationChains = buildCitationChains(allEdges, nameById);

  const reportingDependencyMap = buildReportingDependencyMap(
    evidence,
    allEdges,
    syndicatedSourceIds,
    independentIds,
  );

  const syndicatedSourceCount = syndicatedSourceIds.size;
  const topOrigin = originalSourceLikelihood[0];

  const summaryParts = [
    `Traced ${evidence.length} evidence item(s) across ${reportingDependencyMap.nodes.length} source(s).`,
    topOrigin
      ? `Most likely origin: ${topOrigin.sourceName} (${topOrigin.likelihood}% likelihood, ${topOrigin.role}).`
      : "No origin candidate identified.",
    `${independentSourceCount} independent, ${syndicatedSourceCount} syndicated/repeat source(s).`,
  ];

  if (wirePropagation.length > 0) {
    summaryParts.push(
      `${wirePropagation.length} wire propagation path(s): ${wirePropagation.map((p) => p.wireSourceName).join(", ")}.`,
    );
  }
  if (citationChains.length > 0) {
    summaryParts.push(`${citationChains.length} citation chain(s) detected.`);
  }
  if (circularReporting.length > 0) {
    summaryParts.push(`${circularReporting.length} circular reporting signal(s).`);
  }
  if (repeatedOriginalSourceGroups.length > 0) {
    summaryParts.push(
      `${repeatedOriginalSourceGroups.length} group(s) repeat the same original source.`,
    );
  }

  return {
    claimId,
    claimText,
    originalSourceLikelihood,
    reportingDependencyMap,
    independentSourceCount,
    syndicatedSourceCount,
    citationChains,
    wirePropagation,
    circularReporting,
    repeatedOriginalSourceGroups,
    traceSummary: summaryParts.join(" "),
    computedAt: new Date().toISOString(),
  };
}

export function buildSourceChainTraces(
  inputs: SourceChainTraceInput[],
): SourceChainTraceReport[] {
  return inputs.map(buildSourceChainTrace);
}
