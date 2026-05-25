import { buildDynamicHistoricalReliabilityReport } from "@/server/reliability/dynamic-historical";
import type {
  DynamicHistoricalReliabilityInput,
  DynamicHistoricalReliabilityJson,
} from "./types";

/**
 * Dynamic Historical Reliability Engine
 *
 * Maintains rolling reliability history; tracks corrections, contradiction frequency,
 * evidence quality trends, and topic-specific reliability. Recalculates when new
 * evidence appears. Returns structured JSON only.
 */
export function runDynamicHistoricalReliability(
  input: DynamicHistoricalReliabilityInput,
): DynamicHistoricalReliabilityJson {
  return buildDynamicHistoricalReliabilityReport(input);
}

export function runDynamicHistoricalReliabilityBatch(
  inputs: DynamicHistoricalReliabilityInput[],
): DynamicHistoricalReliabilityJson[] {
  return inputs.map(runDynamicHistoricalReliability);
}
