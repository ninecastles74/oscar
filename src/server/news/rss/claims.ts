/**
 * Claim extraction from RSS summaries is deferred to the LLM analysis pipeline.
 * RSS ingest only reserves the field so downstream stages can populate it.
 */
export function extractClaimsFromRssSummary(_summary: string, _title: string): string[] {
  return [];
}
