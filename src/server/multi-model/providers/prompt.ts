import type { ClaimVerificationPromptInput } from "./types";

const VERDICT_LIST = "supported | disputed | unclear | insufficient_evidence";

export function buildVerificationPrompt(input: ClaimVerificationPromptInput): {
  system: string;
  user: string;
} {
  const roleGuide =
    input.role === "primary"
      ? "You are the primary fact-check analyst. Assess the claim against the evidence passages."
      : input.role === "review"
        ? "You are an independent reviewer. The primary model was uncertain or flagged dispute — re-evaluate carefully."
        : "You are a fast corroboration scanner. Give a lightweight second opinion; favor brevity.";

  const prior =
    input.priorVerdict &&
    `\nPrimary analysis: ${input.priorVerdict.verdict} (${input.priorVerdict.confidence}% confidence). Reasoning: ${input.priorVerdict.reasoning}`;

  return {
    system: `${roleGuide} Return JSON only: {"verdict":"${VERDICT_LIST}","confidence":0-100,"reasoning":"one or two sentences"}. Base conclusions on supplied evidence only; do not invent sources.`,
    user: `Claim: "${input.claimText}"\n\nEvidence:\n${input.evidenceSummary}${prior ?? ""}`,
  };
}

export function formatEvidenceSummary(
  evidence: { stance: string; sourceName?: string; excerpt: string }[],
): string {
  if (evidence.length === 0) return "(No evidence passages retrieved.)";
  return evidence
    .slice(0, 6)
    .map(
      (e, i) =>
        `${i + 1}. [${e.stance}] ${e.sourceName ?? "source"}: "${e.excerpt.slice(0, 200)}"`,
    )
    .join("\n");
}
