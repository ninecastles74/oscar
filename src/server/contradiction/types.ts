import type { EvidenceItem } from "@/types/news-platform";
import type { ClassifiedClaim, ContradictionFinding, MissingContextFinding } from "../analysis/verification/types";

export interface PeerArticleSlice {
  articleId: string;
  sourceId: string;
  sourceName: string;
  title: string;
  text: string;
  publishedAt?: string;
}

export interface ContradictionAnalysisInput {
  claim: ClassifiedClaim | { id: string; text: string; kind?: string; verifiable?: boolean };
  evidence: EvidenceItem[];
  peerArticles?: PeerArticleSlice[];
}

export interface ContradictionBatchResult {
  byClaimId: Record<string, import("@/types/news-platform").ContradictionAnalysisReport>;
  contradictions: ContradictionFinding[];
  missingContext: MissingContextFinding[];
}
