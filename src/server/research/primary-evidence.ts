import type { EvidenceItem, ResearchEvidence } from "@/types/news-platform";
import { computeDynamicWeight } from "../evidence-weighting/compute-weight";
import { approvedSourceById } from "../analysis/sources";

const WIRE_PRIMARY = new Set(["s1", "s2"]); // Reuters, AP
const SECONDARY_PATTERNS =
  /\b(according to|reported by|sources said|per |citing |quoted |as reported)\b/i;
const SYNDICATION_PATTERNS = /\b(wire report|syndicated|reprinted|via reuters|via ap|from reuters|from ap)\b/i;

export function enrichAndPrioritizeEvidence(evidence: EvidenceItem[]): ResearchEvidence[] {
  const sorted = [...evidence].sort((a, b) => {
    const ra = approvedSourceById(a.sourceId)?.reliability ?? 50;
    const rb = approvedSourceById(b.sourceId)?.reliability ?? 50;
    return rb - ra;
  });

  return sorted.map((e, index) => {
    const src = approvedSourceById(e.sourceId);
    const reliability = src?.reliability ?? 50;
    let tier: ResearchEvidence["tier"] = "secondary";

    if (WIRE_PRIMARY.has(e.sourceId) && !SECONDARY_PATTERNS.test(e.excerpt)) {
      tier = "primary";
    } else if (SECONDARY_PATTERNS.test(e.excerpt) || SYNDICATION_PATTERNS.test(e.excerpt)) {
      tier = "derivative";
    } else if (index === 0 && reliability >= 88) {
      tier = "primary";
    }

    const weighted = computeDynamicWeight(e, { tier });
    return {
      ...e,
      tier,
      ...weighted,
      reliabilityWeight: weighted.dynamicWeight,
      isCopiedReporting: false,
      isIndependentConfirmation: false,
      weakSourcing: false,
      citesAnonymousSource: false,
    };
  });
}

export function getPrimaryEvidence(items: ResearchEvidence[]): ResearchEvidence[] {
  const primary = items.filter((e) => e.tier === "primary");
  if (primary.length > 0) return primary;
  return items.filter((e) => e.tier === "secondary").slice(0, 2);
}
