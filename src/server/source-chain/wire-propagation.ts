import type { EvidenceItem, ReportingDependencyEdge, WirePropagationPath } from "@/types/news-platform";
import { WIRE_NAMES, WIRE_SOURCE_IDS } from "./config";

export function detectWirePropagation(
  evidence: EvidenceItem[],
): { paths: WirePropagationPath[]; edges: ReportingDependencyEdge[] } {
  const paths: WirePropagationPath[] = [];
  const edges: ReportingDependencyEdge[] = [];

  for (const wireId of WIRE_SOURCE_IDS) {
    const wireName = WIRE_NAMES[wireId];
    const downstream = new Set<string>();

    for (const item of evidence) {
      if (item.sourceId === wireId) continue;
      const citesWire =
        item.excerpt.toLowerCase().includes(wireName.toLowerCase()) ||
        /\b(via|from)\s+(reuters|ap|associated press)\b/i.test(item.excerpt);
      if (citesWire) {
        downstream.add(item.sourceId);
        edges.push({
          fromSourceId: item.sourceId,
          toSourceId: wireId,
          relationship: "wire_propagation",
          evidenceIds: [item.id],
          strength: 0.85,
        });
      }
    }

    const wireEvidence = evidence.filter((e) => e.sourceId === wireId);
    if (wireEvidence.length > 0 || downstream.size > 0) {
      paths.push({
        wireSourceId: wireId,
        wireSourceName: wireName,
        downstreamSourceIds: [...downstream],
        propagationDepth: downstream.size > 0 ? 1 + Math.ceil(downstream.size / 3) : 0,
      });
    }
  }

  return { paths, edges };
}
