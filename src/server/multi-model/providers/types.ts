import type { Verdict } from "@/types/news-platform";

export interface LlmVerdictPayload {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
}

export interface ClaimVerificationPromptInput {
  claimText: string;
  evidenceSummary: string;
  priorVerdict?: { verdict: Verdict; confidence: number; reasoning: string };
  role: "primary" | "review" | "corroboration";
}

export interface VerifyClaimApiInput {
  claimId: string;
  claimText: string;
  evidence: { stance: string; sourceName?: string; excerpt: string }[];
  role: "primary" | "review" | "corroboration";
  priorVerdict?: { verdict: Verdict; confidence: number; reasoning: string };
}
