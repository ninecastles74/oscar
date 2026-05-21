import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifyClaims } from "../analysis/verification/classifyClaims";
import { extractClaims } from "../analysis/verification/extractClaims";
import { retrieveEvidence } from "../analysis/verification/retrieveEvidence";
import { buildSourceChainTrace } from "./build-trace";

const traceClaimSchema = z.object({
  claimId: z.string().optional(),
  text: z.string().min(10),
});

/** Trace source chains for a single claim. */
export const traceClaimSourceChain = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => traceClaimSchema.parse(data))
  .handler(async ({ data }) => {
    const prefix = data.claimId ?? "trace";
    const raw = extractClaims(data.text, prefix);
    const classified = classifyClaims(raw);
    const claim = classified[0];
    const evidenceByClaimId = retrieveEvidence(classified);
    return buildSourceChainTrace({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidenceByClaimId[claim.id] ?? [],
    });
  });
