import type { CitationChain, EvidenceItem, ReportingDependencyEdge } from "@/types/news-platform";
import {
  CITATION_PATTERNS,
  resolveSourceId,
  sourceNameIndex,
} from "./config";

export function detectCitationEdges(
  evidence: EvidenceItem[],
): ReportingDependencyEdge[] {
  const index = sourceNameIndex();
  const edges: ReportingDependencyEdge[] = [];

  for (const item of evidence) {
    for (const { relationship, re } of CITATION_PATTERNS) {
      const match = item.excerpt.match(re);
      if (!match?.[1]) continue;
      const targetId = resolveSourceId(match[1], index);
      if (!targetId || targetId === item.sourceId) continue;
      edges.push({
        fromSourceId: item.sourceId,
        toSourceId: targetId,
        relationship,
        evidenceIds: [item.id],
        strength: relationship === "wire_propagation" ? 0.9 : 0.75,
      });
    }
  }

  return dedupeEdges(edges);
}

export function buildCitationChains(
  edges: ReportingDependencyEdge[],
  nameById: Map<string, string>,
): CitationChain[] {
  const upstream = new Map<string, string[]>();
  for (const e of edges) {
    if (e.relationship === "cites" || e.relationship === "paraphrases" || e.relationship === "wire_propagation") {
      const list = upstream.get(e.fromSourceId) ?? [];
      if (!list.includes(e.toSourceId)) list.push(e.toSourceId);
      upstream.set(e.fromSourceId, list);
    }
  }

  const chains: CitationChain[] = [];
  const seen = new Set<string>();

  for (const [leaf, ups] of upstream) {
    for (const root of ups) {
      const ordered = [root, leaf];
      const key = ordered.join("->");
      if (seen.has(key)) continue;
      seen.add(key);
      chains.push({
        chainId: `cite_${root}_${leaf}`,
        orderedSourceIds: ordered,
        orderedSourceNames: ordered.map((id) => nameById.get(id) ?? id),
        description: `${nameById.get(leaf) ?? leaf} traces to ${nameById.get(root) ?? root} via explicit citation language.`,
      });
    }
  }

  const multiHop = buildMultiHopChains(edges, nameById);
  for (const c of multiHop) {
    const key = c.orderedSourceIds.join("->");
    if (!seen.has(key)) {
      seen.add(key);
      chains.push(c);
    }
  }

  return chains;
}

function buildMultiHopChains(
  edges: ReportingDependencyEdge[],
  nameById: Map<string, string>,
): CitationChain[] {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.fromSourceId) ?? [];
    list.push(e.toSourceId);
    adj.set(e.fromSourceId, list);
  }

  const chains: CitationChain[] = [];
  for (const start of adj.keys()) {
    const path = [start];
    const visited = new Set([start]);
    let current = start;
    for (let hop = 0; hop < 4; hop++) {
      const next = adj.get(current)?.find((n) => !visited.has(n));
      if (!next) break;
      path.push(next);
      visited.add(next);
      current = next;
    }
    if (path.length >= 3) {
      chains.push({
        chainId: `chain_${path.join("_")}`,
        orderedSourceIds: [...path].reverse(),
        orderedSourceNames: [...path].reverse().map((id) => nameById.get(id) ?? id),
        description: `Multi-hop citation chain: ${path
          .map((id) => nameById.get(id) ?? id)
          .join(" → ")}.`,
      });
    }
  }
  return chains;
}

function dedupeEdges(edges: ReportingDependencyEdge[]): ReportingDependencyEdge[] {
  const key = (e: ReportingDependencyEdge) =>
    `${e.fromSourceId}|${e.toSourceId}|${e.relationship}`;
  const map = new Map<string, ReportingDependencyEdge>();
  for (const e of edges) {
    const k = key(e);
    const existing = map.get(k);
    if (existing) {
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...e.evidenceIds])];
      existing.strength = Math.max(existing.strength, e.strength);
    } else {
      map.set(k, { ...e });
    }
  }
  return [...map.values()];
}
