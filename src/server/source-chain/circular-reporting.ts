import type { CircularReportingFinding, ReportingDependencyEdge } from "@/types/news-platform";
import { excerptSimilarity } from "../research/text-similarity";

export function detectCircularReporting(
  edges: ReportingDependencyEdge[],
  excerptsBySource: Map<string, string[]>,
): CircularReportingFinding[] {
  const findings: CircularReportingFinding[] = [];
  const adj = new Map<string, Set<string>>();

  for (const e of edges) {
    const set = adj.get(e.fromSourceId) ?? new Set();
    set.add(e.toSourceId);
    adj.set(e.fromSourceId, set);
  }

  const cycles = findCycles(adj);
  for (const cycle of cycles) {
    findings.push({
      sourceIds: cycle,
      description: `Circular reporting loop: ${cycle.join(" → ")} → ${cycle[0]}. Outlets may be reinforcing each other without independent verification.`,
      severity: cycle.length >= 3 ? "critical" : "warning",
    });
  }

  const mutual = findMutualCitationPairs(edges, excerptsBySource);
  for (const pair of mutual) {
    const key = pair.sort().join("|");
    if (cycles.some((c) => c.length === 2 && c.sort().join("|") === key)) continue;
    findings.push({
      sourceIds: pair,
      description: `Mutual dependency: ${pair[0]} and ${pair[1]} cite or echo each other with similar language — possible circular amplification.`,
      severity: "warning",
    });
  }

  return findings;
}

function findCycles(adj: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const next of adj.get(node) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (stack.has(next)) {
        const start = path.indexOf(next);
        if (start >= 0) {
          const cycle = path.slice(start);
          if (cycle.length >= 2) cycles.push([...cycle, next]);
        }
      }
    }

    path.pop();
    stack.delete(node);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) dfs(node);
  }

  return cycles;
}

function findMutualCitationPairs(
  edges: ReportingDependencyEdge[],
  excerptsBySource: Map<string, string[]>,
): [string, string][] {
  const pairs: [string, string][] = [];
  const citeMap = new Map<string, Set<string>>();

  for (const e of edges) {
    if (e.relationship === "cites" || e.relationship === "paraphrases" || e.relationship === "wire_propagation") {
      const set = citeMap.get(e.fromSourceId) ?? new Set();
      set.add(e.toSourceId);
      citeMap.set(e.fromSourceId, set);
    }
  }

  for (const [a, upsA] of citeMap) {
    for (const b of upsA) {
      if (citeMap.get(b)?.has(a)) {
        const exA = excerptsBySource.get(a)?.[0] ?? "";
        const exB = excerptsBySource.get(b)?.[0] ?? "";
        if (excerptSimilarity(exA, exB) >= 0.5) {
          pairs.push([a, b]);
        }
      }
    }
  }

  return pairs;
}
