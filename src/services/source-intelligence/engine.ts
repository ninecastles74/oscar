import { buildSourceChainTrace } from "@/server/source-chain/build-trace";
import type { EvidenceItem } from "@/types/news-platform";
import { detectAnonymousSourceDependency } from "./anonymous-sources";
import {
  computeIndependenceScore,
  computeRepetitionRiskScore,
  computeSourceOriginScore,
} from "./scoring";
import type {
  SourceIndependenceAnalysisJson,
  SourceIndependenceInput,
  SourceIntelligenceDependencyMap,
} from "./types";

/**
 * Source Independence & Chain Tracing Engine
 *
 * Identifies original-source likelihood, citation chains, wire propagation,
 * circular reporting, syndicated repetition, anonymous-source dependency, and
 * multi-outlet repetition of one original claim.
 *
 * Returns structured JSON only (no prose summaries).
 */
export function analyzeSourceIndependence(
  input: SourceIndependenceInput,
): SourceIndependenceAnalysisJson {
  const trace = buildSourceChainTrace({
    claimId: input.claimId,
    claimText: input.claimText,
    evidence: input.evidence,
  });

  const anonymousSourceDependency = detectAnonymousSourceDependency(
    input.evidence,
    input.claimText,
  );

  const reportingDependencyMap: SourceIntelligenceDependencyMap = {
    nodes: trace.reportingDependencyMap.nodes,
    edges: trace.reportingDependencyMap.edges,
    citationChains: trace.citationChains,
    wirePropagation: trace.wirePropagation,
    circularReporting: trace.circularReporting,
    originalSourceLikelihood: trace.originalSourceLikelihood,
    anonymousSourceDependency,
    repeatedOriginalSourceGroups: trace.repeatedOriginalSourceGroups,
  };

  return {
    independenceScore: computeIndependenceScore(trace, anonymousSourceDependency),
    sourceOriginScore: computeSourceOriginScore(trace),
    reportingDependencyMap,
    independentSourceCount: trace.independentSourceCount,
    repetitionRiskScore: computeRepetitionRiskScore(trace, anonymousSourceDependency),
  };
}

/** Batch analyze multiple claims; each result is independent structured JSON. */
export function analyzeSourceIndependenceBatch(
  inputs: SourceIndependenceInput[],
): SourceIndependenceAnalysisJson[] {
  return inputs.map(analyzeSourceIndependence);
}

/** Build minimal evidence rows from outlet coverage snippets (for feed / cluster use). */
export function evidenceFromCoverage(
  items: {
    id: string;
    sourceId: string;
    sourceName: string;
    excerpt: string;
    url: string;
    publishedAt?: string;
    supports?: boolean;
  }[],
): EvidenceItem[] {
  return items.map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    excerpt: item.excerpt,
    url: item.url,
    publishedAt: item.publishedAt ?? new Date().toISOString(),
    stance: item.supports === false ? "contradict" : "support",
    supports: item.supports !== false,
  }));
}
