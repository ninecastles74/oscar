/** Report IDs pending confidence/score recalculation after new evidence. */
const pendingRecalculations = new Set<string>();

export function enqueueEvidenceRecalculation(reportId: string): void {
  pendingRecalculations.add(reportId);
}

export function dequeueEvidenceRecalculations(): string[] {
  const ids = [...pendingRecalculations];
  pendingRecalculations.clear();
  return ids;
}

export function peekEvidenceRecalculationQueue(): string[] {
  return [...pendingRecalculations];
}

export function getEvidenceRecalculationQueueSize(): number {
  return pendingRecalculations.size;
}
