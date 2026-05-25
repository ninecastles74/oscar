import type {
  AnonymousSourceFlag,
  CitationChain,
  CircularReportingFinding,
  EvidenceItem,
  OriginalSourceLikelihood,
  ReportingDependencyMap,
  RepeatedOriginalSourceGroup,
  WirePropagationPath,
} from "@/types/news-platform";

/** Input for the Source Independence & Chain Tracing Engine. */
export interface SourceIndependenceInput {
  claimId: string;
  claimText: string;
  evidence: EvidenceItem[];
}

/**
 * Extended dependency map — nodes/edges plus chain-tracing artifacts (JSON-serializable).
 */
export interface SourceIntelligenceDependencyMap extends ReportingDependencyMap {
  citationChains: CitationChain[];
  wirePropagation: WirePropagationPath[];
  circularReporting: CircularReportingFinding[];
  originalSourceLikelihood: OriginalSourceLikelihood[];
  anonymousSourceDependency: AnonymousSourceFlag[];
  repeatedOriginalSourceGroups: RepeatedOriginalSourceGroup[];
}

/**
 * Structured JSON output from the Source Independence & Chain Tracing Engine.
 */
export interface SourceIndependenceAnalysisJson {
  independenceScore: number;
  sourceOriginScore: number;
  reportingDependencyMap: SourceIntelligenceDependencyMap;
  independentSourceCount: number;
  repetitionRiskScore: number;
}
