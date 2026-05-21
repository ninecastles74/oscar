import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { retrieveEvidence } from "../analysis/verification/retrieveEvidence";
import { classifyClaims } from "../analysis/verification/classifyClaims";
import { extractClaims } from "../analysis/verification/extractClaims";
import { buildClaimResearch, buildClaimsResearch } from "./build-research";

const claimSchema = z.object({
  claimId: z.string().optional(),
  text: z.string().min(10),
});

const claimsSchema = z.object({
  claims: z.array(claimSchema).min(1),
  articleText: z.string().min(40).optional(),
});

/** Research a single claim across approved evidence sources. */
export const researchClaim = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => claimSchema.parse(data))
  .handler(async ({ data }) => {
    const prefix = data.claimId ?? "res";
    const raw = extractClaims(data.text, prefix);
    const classified = classifyClaims(raw);
    const claim = classified[0];
    const evidenceByClaimId = retrieveEvidence(classified);
    const report = buildClaimResearch({
      claim,
      evidence: evidenceByClaimId[claim.id] ?? [],
    });
    return report;
  });

/** Research multiple claims (batch). */
export const researchClaims = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => claimsSchema.parse(data))
  .handler(async ({ data }) => {
    const text = data.articleText ?? data.claims.map((c) => c.text).join("\n");
    const raw = extractClaims(text, "batch");
    const classified = classifyClaims(raw).slice(0, data.claims.length);
    const evidenceByClaimId = retrieveEvidence(classified);
    const inputs = classified.map((c, i) => ({
      claim: { ...c, text: data.claims[i]?.text ?? c.text },
      evidence: evidenceByClaimId[c.id] ?? [],
    }));
    return buildClaimsResearch(inputs);
  });
