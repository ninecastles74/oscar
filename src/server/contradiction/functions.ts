import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classifyClaims } from "../analysis/verification/classifyClaims";
import { extractClaims } from "../analysis/verification/extractClaims";
import { retrieveEvidence } from "../analysis/verification/retrieveEvidence";
import { buildContradictionAnalysis } from "./build-analysis";

const inputSchema = z.object({
  text: z.string().min(10),
});

export const analyzeClaimContradictions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const raw = extractClaims(data.text, "contra");
    const classified = classifyClaims(raw);
    const claim = classified[0];
    const evidenceByClaimId = retrieveEvidence(classified);
    return buildContradictionAnalysis({
      claim,
      evidence: evidenceByClaimId[claim.id] ?? [],
    });
  });
