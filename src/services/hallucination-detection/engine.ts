import { buildHallucinationDetectionReport } from "@/server/hallucination-detection";
import { applyHallucinationMitigation } from "@/server/hallucination-detection/mitigate";
import type {
  HallucinationDetectionInput,
  HallucinationDetectionJson,
  HallucinationMitigationResult,
} from "./types";

/**
 * AI Hallucination Detection Layer (service facade)
 *
 * Detects unsupported AI conclusions, fabricated citations, weak evidence chains,
 * low-confidence reasoning; requires evidence-backed outputs; reduces confidence
 * when model disagreement is high. Returns epistemic verdicts only.
 */
export function detectHallucination(
  input: HallucinationDetectionInput,
): HallucinationDetectionJson {
  return buildHallucinationDetectionReport(input);
}

/** Alias for the AI Hallucination Detection Layer. */
export const detectAiHallucination = detectHallucination;

export function detectHallucinationBatch(
  inputs: HallucinationDetectionInput[],
): HallucinationDetectionJson[] {
  return inputs.map(detectHallucination);
}

export function mitigateHallucination(
  input: Parameters<typeof applyHallucinationMitigation>[0],
): HallucinationMitigationResult {
  return applyHallucinationMitigation(input);
}
