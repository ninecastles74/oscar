import type { Category, OrganizationReliabilityScore } from "@/types/news-platform";
import type { ArticleReliabilityScore } from "@/types/news-platform";
import { APPROVED_SOURCES } from "../analysis/sources";
import { calculateSourceScore } from "./services/source-score.service";
import { getOrganizationScores } from "./store";

function orgMeta(organizationId: string): { name: string; domain: string } {
  const domain = organizationId.replace(/^org_/, "").replace(/_/g, ".");
  const src = APPROVED_SOURCES.find((s) => s.domain === domain || s.id === organizationId);
  return { name: src?.name ?? domain, domain: src?.domain ?? domain };
}

/** @deprecated Use calculateSourceScore from services */
export function computeOrganizationReliabilityScore(
  organizationId: string,
  articleScore: ArticleReliabilityScore,
  topic: Category,
): OrganizationReliabilityScore {
  const { name, domain } = orgMeta(organizationId);
  const prior = getOrganizationScores(organizationId);
  return calculateSourceScore({
    organizationId,
    name,
    domain,
    topic,
    articleScore: articleScore as import("./types/scoring.types").ArticleScoreResult,
    scoreHistory: prior.map((p) => ({ recordedAt: p.computedAt, score: p.overallScore })),
    version: prior.length + 1,
  });
}
