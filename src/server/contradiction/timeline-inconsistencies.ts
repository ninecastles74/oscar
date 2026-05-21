import type { ContradictionIssue, EvidenceItem, TimelineInconsistency } from "@/types/news-platform";

const DATE_IN_TEXT =
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\b(?:on|by|before|after|since)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|yesterday|today|last week|next week))\b/gi;

const SEQUENCE_WORDS = /\b(before|after|prior to|following|subsequently|earlier|later|then|first|second)\b/i;

export function detectTimelineInconsistencies(
  claimId: string,
  claimText: string,
  evidence: EvidenceItem[],
): { inconsistencies: TimelineInconsistency[]; issues: ContradictionIssue[] } {
  const inconsistencies: TimelineInconsistency[] = [];
  const issues: ContradictionIssue[] = [];

  const claimDates = extractDates(claimText);
  const bySource = new Map<string, { dates: string[]; publishedAt?: string }>();

  for (const e of evidence) {
    const dates = [...extractDates(e.excerpt), ...(e.publishedAt ? [e.publishedAt] : [])];
    const existing = bySource.get(e.sourceId) ?? { dates: [] };
    existing.dates.push(...dates);
    if (e.publishedAt) existing.publishedAt = e.publishedAt;
    bySource.set(e.sourceId, existing);
  }

  if (claimDates.length >= 2 && SEQUENCE_WORDS.test(claimText)) {
    inconsistencies.push({
      claimId,
      description: `Claim references multiple time points (${claimDates.slice(0, 3).join(", ")}) — verify sequence against source timelines.`,
      datesMentioned: claimDates,
      conflictingSources: [],
      severity: "warning",
    });
    issues.push({
      issueId: `${claimId}_time_claim`,
      type: "timeline_inconsistency",
      claimId,
      description: inconsistencies[inconsistencies.length - 1].description,
      severity: "warning",
    });
  }

  const sourceIds = [...bySource.keys()];
  if (sourceIds.length >= 2) {
    const publishedAts = sourceIds
      .map((id) => ({ id, at: bySource.get(id)?.publishedAt }))
      .filter((x) => x.at) as { id: string; at: string }[];

    if (publishedAts.length >= 2) {
      const sorted = [...publishedAts].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
      );
      const early = sorted[0];
      const late = sorted[sorted.length - 1];
      const earlyEvidence = evidence.find((e) => e.sourceId === early.id);
      const lateEvidence = evidence.find((e) => e.sourceId === late.id);

      if (
        earlyEvidence?.stance === "contradict" &&
        lateEvidence?.stance === "support" &&
        /\b(initially|first|earlier|denied|disputed)\b/i.test(lateEvidence.excerpt)
      ) {
        inconsistencies.push({
          claimId,
          description: `Timeline tension: earlier report (${early.at}) disputes while later coverage (${late.at}) supports — narrative may have shifted.`,
          datesMentioned: [early.at, late.at],
          conflictingSources: [early.id, late.id],
          severity: "warning",
        });
        issues.push({
          issueId: `${claimId}_time_shift`,
          type: "timeline_inconsistency",
          claimId,
          description: inconsistencies[inconsistencies.length - 1].description,
          severity: "warning",
          sourceIds: [early.id, late.id],
        });
      }
    }

    const dateSets = sourceIds.map((id) => ({
      id,
      dates: new Set(bySource.get(id)?.dates.map(normalizeDate) ?? []),
    }));
    for (let i = 0; i < dateSets.length; i++) {
      for (let j = i + 1; j < dateSets.length; j++) {
        const a = dateSets[i];
        const b = dateSets[j];
        const onlyA = [...a.dates].filter((d) => !b.dates.has(d));
        const onlyB = [...b.dates].filter((d) => !a.dates.has(d));
        if (onlyA.length > 0 && onlyB.length > 0 && a.dates.size > 0 && b.dates.size > 0) {
          inconsistencies.push({
            claimId,
            description: `Sources cite different time references (${onlyA[0]} vs ${onlyB[0]}) — possible timeline inconsistency.`,
            datesMentioned: [...onlyA, ...onlyB].slice(0, 4),
            conflictingSources: [a.id, b.id],
            severity: "critical",
          });
          issues.push({
            issueId: `${claimId}_time_${a.id}_${b.id}`,
            type: "timeline_inconsistency",
            claimId,
            description: inconsistencies[inconsistencies.length - 1].description,
            severity: "critical",
            sourceIds: [a.id, b.id],
          });
        }
      }
    }
  }

  return { inconsistencies, issues };
}

function extractDates(text: string): string[] {
  const matches = text.match(DATE_IN_TEXT);
  return matches ? [...new Set(matches.map((m) => m.trim()))] : [];
}

function normalizeDate(d: string): string {
  return d.toLowerCase().replace(/\s+/g, " ").trim();
}
