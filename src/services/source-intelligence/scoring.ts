import type { SourceChainTraceReport } from "@/types/news-platform";
import type { AnonymousSourceFlag } from "@/types/news-platform";

/** 0–100: how independent the reporting pool is (not syndicated / circular / anonymous-heavy). */
export function computeIndependenceScore(
  trace: SourceChainTraceReport,
  anonymousFlags: AnonymousSourceFlag[],
): number {
  const nodes = trace.reportingDependencyMap.nodes.length;
  if (nodes === 0) return 0;

  const independentRatio = trace.independentSourceCount / nodes;
  let score = independentRatio * 100;

  const syndicatedRatio = trace.syndicatedSourceCount / nodes;
  score -= syndicatedRatio * 35;

  if (trace.circularReporting.some((c) => c.severity === "critical")) score -= 25;
  else if (trace.circularReporting.length > 0) score -= 12;

  if (trace.wirePropagation.length > 0 && trace.independentSourceCount <= 1) score -= 15;

  score -= Math.min(20, anonymousFlags.length * 6);

  if (trace.repeatedOriginalSourceGroups.length > 0) {
    score -= Math.min(15, trace.repeatedOriginalSourceGroups.length * 5);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** 0–100: likelihood the ranked origin is truly upstream (from origin ranking). */
export function computeSourceOriginScore(trace: SourceChainTraceReport): number {
  const top = trace.originalSourceLikelihood[0];
  if (!top) return 0;
  let score = top.likelihood;
  if (top.role === "syndicated_repeat") score = Math.max(5, score - 30);
  if (top.role === "wire_origin" && trace.independentSourceCount > 1) score = Math.min(100, score + 5);
  return Math.round(Math.min(100, Math.max(0, score)));
}

/** 0–100: risk that outlets are repeating one original claim without verification. */
export function computeRepetitionRiskScore(
  trace: SourceChainTraceReport,
  anonymousFlags: AnonymousSourceFlag[],
): number {
  const nodes = trace.reportingDependencyMap.nodes.length;
  if (nodes === 0) return 0;

  let risk = 0;
  risk += (trace.syndicatedSourceCount / nodes) * 45;
  risk += trace.repeatedOriginalSourceGroups.length * 12;
  risk += trace.circularReporting.length * 10;
  if (trace.circularReporting.some((c) => c.severity === "critical")) risk += 15;

  for (const group of trace.repeatedOriginalSourceGroups) {
    risk += Math.min(20, group.repeatingSourceIds.length * 4);
  }

  if (trace.wirePropagation.length > 0) {
    const maxDownstream = Math.max(...trace.wirePropagation.map((p) => p.downstreamSourceIds.length), 0);
    risk += Math.min(25, maxDownstream * 5);
  }

  if (trace.independentSourceCount <= 1 && nodes >= 3) risk += 20;

  risk += Math.min(15, anonymousFlags.length * 4);

  return Math.round(Math.min(100, Math.max(0, risk)));
}
