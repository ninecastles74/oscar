import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifyClaims } from "../analysis/verification/classifyClaims";
import { extractClaims } from "../analysis/verification/extractClaims";
import { retrieveEvidence } from "../analysis/verification/retrieveEvidence";
import { aggregateEvidenceQuality } from "./aggregate-quality";

const inputSchema = z.object({
  text: z.string().min(10),
});

/** Score evidence quality for a claim using dynamic weighting. */
export const scoreClaimEvidenceQuality = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const raw = extractClaims(data.text, "ew");
    const classified = classifyClaims(raw);
    const claim = classified[0];
    const evidenceByClaimId = retrieveEvidence(classified);
    const evidence = evidenceByClaimId[claim.id] ?? [];
    return {
      claimId: claim.id,
      claimText: claim.text,
      evidence: aggregateEvidenceQuality(evidence),
      items: evidence,
    };
  });
