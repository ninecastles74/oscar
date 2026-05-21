import type {
  CopiedReportingPair,
  EvidenceItem,
  RepeatedOriginalSourceGroup,
  ReportingDependencyEdge,
} from "@/types/news-platform";
import { excerptSimilarity } from "../research/text-similarity";
import { approvedSourceById } from "../analysis/sources";

const COPY_THRESHOLD = 0.72;

export function detectSyndication(
  evidence: EvidenceItem[],
): {
  pairs: CopiedReportingPair[];
  edges: ReportingDependencyEdge[];
  syndicatedSourceIds: Set<string>;
  groups: RepeatedOriginalSourceGroup[];
} {
  const pairs: CopiedReportingPair[] = [];
  const edges: ReportingDependencyEdge[] = [];
  const syndicatedSourceIds = new Set<string>();
  const groups: RepeatedOriginalSourceGroup[] = [];

  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const sim = excerptSimilarity(evidence[i].excerpt, evidence[j].excerpt);
      if (sim < COPY_THRESHOLD) continue;
      pairs.push({
        sourceA: evidence[i].sourceId,
        sourceB: evidence[j].sourceId,
        excerptOverlap: Math.round(sim * 100),
        likelySyndicated: sim >= 0.85,
      });
      syndicatedSourceIds.add(evidence[i].sourceId);
      syndicatedSourceIds.add(evidence[j].sourceId);

      const upstream = pickLikelyUpstream(evidence[i], evidence[j]);
      const downstream = upstream.sourceId === evidence[i].sourceId ? evidence[j] : evidence[i];
      edges.push({
        fromSourceId: downstream.sourceId,
        toSourceId: upstream.sourceId,
        relationship: sim >= 0.85 ? "syndicates" : "repeats_excerpt",
        evidenceIds: [evidence[i].id, evidence[j].id],
        strength: sim,
      });
    }
  }

  const byUpstream = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.relationship !== "syndicates" && e.relationship !== "repeats_excerpt") continue;
    const set = byUpstream.get(e.toSourceId) ?? new Set();
    set.add(e.fromSourceId);
    byUpstream.set(e.toSourceId, set);
  }

  for (const [upstreamId, repeating] of byUpstream) {
    if (repeating.size < 1) continue;
    const src = approvedSourceById(upstreamId);
    groups.push({
      upstreamSourceId: upstreamId,
      upstreamSourceName: src?.name ?? upstreamId,
      repeatingSourceIds: [...repeating],
      reason: `${repeating.size} outlet(s) repeat the same or near-identical excerpt from a shared upstream.`,
    });
  }

  return { pairs, edges, syndicatedSourceIds, groups };
}

function pickLikelyUpstream(a: EvidenceItem, b: EvidenceItem): EvidenceItem {
  const ra = approvedSourceById(a.sourceId)?.reliability ?? 50;
  const rb = approvedSourceById(b.sourceId)?.reliability ?? 50;
  if (ra !== rb) return ra > rb ? a : b;
  return a.excerpt.length <= b.excerpt.length ? a : b;
}

export function countIndependentSources(
  evidence: EvidenceItem[],
  syndicatedSourceIds: Set<string>,
  dependencyUpstream: Set<string>,
): number {
  const supporting = evidence.filter((e) => e.stance === "support" || e.supports);
  const independent = new Set<string>();

  for (const item of supporting) {
    if (syndicatedSourceIds.has(item.sourceId)) continue;
    const onlyDerivative =
      dependencyUpstream.has(item.sourceId) &&
      !supporting.some((o) => o.sourceId !== item.sourceId && !syndicatedSourceIds.has(o.sourceId));
    if (!onlyDerivative || item.stance === "support") {
      independent.add(item.sourceId);
    }
  }

  for (const item of supporting) {
    if (!syndicatedSourceIds.has(item.sourceId)) {
      const hasDistinctExcerpt = supporting.some(
        (o) =>
          o.sourceId !== item.sourceId &&
          o.excerpt.slice(0, 80) !== item.excerpt.slice(0, 80),
      );
      if (hasDistinctExcerpt || !syndicatedSourceIds.has(item.sourceId)) {
        independent.add(item.sourceId);
      }
    }
  }

  return independent.size;
}
