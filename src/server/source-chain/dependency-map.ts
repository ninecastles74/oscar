import type {
  EvidenceItem,
  ReportingDependencyEdge,
  ReportingDependencyMap,
  ReportingDependencyNode,
} from "@/types/news-platform";
import { approvedSourceById } from "../analysis/sources";

export function buildReportingDependencyMap(
  evidence: EvidenceItem[],
  edges: ReportingDependencyEdge[],
  syndicatedSourceIds: Set<string>,
  independentSourceIds: Set<string>,
): ReportingDependencyMap {
  const sourceIds = [...new Set(evidence.map((e) => e.sourceId))];
  const upstreamOf = new Map<string, Set<string>>();

  for (const e of edges) {
    const set = upstreamOf.get(e.fromSourceId) ?? new Set();
    set.add(e.toSourceId);
    upstreamOf.set(e.fromSourceId, set);
  }

  const depthCache = new Map<string, number>();

  function depth(sourceId: string, visiting = new Set<string>()): number {
    if (depthCache.has(sourceId)) return depthCache.get(sourceId)!;
    if (visiting.has(sourceId)) return 0;
    visiting.add(sourceId);
    const ups = upstreamOf.get(sourceId);
    if (!ups || ups.size === 0) {
      depthCache.set(sourceId, 0);
      return 0;
    }
    let maxUp = 0;
    for (const u of ups) maxUp = Math.max(maxUp, 1 + depth(u, visiting));
    depthCache.set(sourceId, maxUp);
    return maxUp;
  }

  const nodes: ReportingDependencyNode[] = sourceIds.map((sourceId) => {
    const src = approvedSourceById(sourceId);
    const name =
      src?.name ?? evidence.find((e) => e.sourceId === sourceId)?.sourceName ?? sourceId;
    return {
      sourceId,
      sourceName: name,
      depth: depth(sourceId),
      isIndependent: independentSourceIds.has(sourceId),
      isSyndicated: syndicatedSourceIds.has(sourceId),
      dependsOn: [...(upstreamOf.get(sourceId) ?? [])],
    };
  });

  nodes.sort((a, b) => a.depth - b.depth || a.sourceName.localeCompare(b.sourceName));

  return { nodes, edges };
}

export function independentSourceIdsFromEvidence(
  evidence: EvidenceItem[],
  syndicatedSourceIds: Set<string>,
): Set<string> {
  const supporting = evidence.filter((e) => e.supports || e.stance === "support");
  const ids = new Set<string>();
  for (const item of supporting) {
    if (syndicatedSourceIds.has(item.sourceId)) continue;
    const distinct = supporting.some(
      (o) =>
        o.sourceId !== item.sourceId &&
        o.excerpt.slice(0, 80) !== item.excerpt.slice(0, 80),
    );
    if (distinct || supporting.filter((s) => s.sourceId === item.sourceId).length === 1) {
      ids.add(item.sourceId);
    }
  }
  return ids;
}
