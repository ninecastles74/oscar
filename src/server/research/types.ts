import type { EvidenceItem } from "@/types/news-platform";
import type { ClassifiedClaim } from "../analysis/verification/types";

export interface ClaimResearchInput {
  claim: ClassifiedClaim | { id: string; text: string; verifiable?: boolean };
  evidence: EvidenceItem[];
  contradictions?: { claimId: string; description: string }[];
}
