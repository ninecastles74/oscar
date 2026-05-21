import type { Claim, Verdict } from "./types";
import { CLUSTERS, clusterById } from "./clusters";
import { SOURCES } from "./sources";
import { CLAIMS_POOL } from "./seed";

export const CLAIMS: Record<string, Claim> = {};

CLUSTERS.forEach((c, ci) => {
  c.claimIds.forEach((cid, j) => {
    const verdicts: Verdict[] = [
      "supported",
      "disputed",
      "insufficient_evidence",
      "supported",
      "unclear",
    ];
    const v = verdicts[(ci + j) % verdicts.length];
    CLAIMS[cid] = {
      id: cid,
      text: CLAIMS_POOL[(ci + j) % CLAIMS_POOL.length],
      verdict: v,
      confidence:
        v === "supported"
          ? 75 + ((ci + j) % 20)
          : v === "disputed"
            ? 68
            : v === "unclear"
              ? 42
              : 28 + ((ci + j) % 15),
      evidence: SOURCES.slice(0, 4 + (j % 3)).map((s, k) => ({
        id: `${cid}-e${k}`,
        sourceId: s.id,
        excerpt:
          k % 2 === 0
            ? "Officials confirmed the figure during a press briefing on Tuesday, citing data from the latest quarterly report."
            : "Independent analysts have questioned the methodology, noting the sample excluded several relevant cohorts.",
        supports: v === "disputed" ? k % 3 === 0 : k % 3 !== 0,
        url: `https://${s.domain}/evidence/${cid}-${k}`,
        citationLabel: `[${s.name}]`,
      })),
      context:
        j % 2 === 0
          ? "Earlier reports omitted the regional breakdown which significantly affects how this number is interpreted."
          : undefined,
    };
  });
});

export function claimsForCluster(id: string): Claim[] {
  const c = clusterById(id);
  return c ? c.claimIds.map((cid) => CLAIMS[cid]) : [];
}
