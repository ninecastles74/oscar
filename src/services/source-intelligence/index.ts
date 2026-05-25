export type {
  SourceIndependenceAnalysisJson,
  SourceIndependenceInput,
  SourceIntelligenceDependencyMap,
} from "./types";

export {
  analyzeSourceIndependence,
  analyzeSourceIndependenceBatch,
  evidenceFromCoverage,
} from "./engine";

export { detectAnonymousSourceDependency } from "./anonymous-sources";
