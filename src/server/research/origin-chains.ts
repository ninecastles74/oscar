import type { ResearchEvidence, SourceOriginChain } from "@/types/news-platform";

const WIRE_ROOTS: Record<string, string> = {
  s1: "Reuters",
  s2: "Associated Press",
};

export function buildOriginChains(items: ResearchEvidence[]): {
  chains: SourceOriginChain[];
  items: ResearchEvidence[];
} {
  const chains: SourceOriginChain[] = [];
  const updated = items.map((e) => ({ ...e }));

  const wireItems = updated.filter((e) => WIRE_ROOTS[e.sourceId]);
  const derivativeByRoot = new Map<string, string[]>();

  for (const item of updated) {
    if (WIRE_ROOTS[item.sourceId]) continue;
    const citesWire = wireItems.find((w) =>
      item.excerpt.toLowerCase().includes(WIRE_ROOTS[w.sourceId].toLowerCase()),
    );
    if (citesWire) {
      const list = derivativeByRoot.get(citesWire.sourceId) ?? [];
      list.push(item.sourceId);
      derivativeByRoot.set(citesWire.sourceId, list);
    }
  }

  for (const [rootId, downstream] of derivativeByRoot) {
    const chainId = `chain_${rootId}`;
    chains.push({
      chainId,
      rootSourceId: rootId,
      rootSourceName: WIRE_ROOTS[rootId] ?? rootId,
      downstreamSourceIds: downstream,
      description: `${WIRE_ROOTS[rootId]} appears as upstream origin; ${downstream.length} outlet(s) cite or paraphrase the wire.`,
    });
    for (const d of downstream) {
      const idx = updated.findIndex((e) => e.sourceId === d);
      if (idx >= 0) {
        updated[idx].originChainId = chainId;
        updated[idx].tier = "derivative";
      }
    }
  }

  return { chains, items: updated };
}
