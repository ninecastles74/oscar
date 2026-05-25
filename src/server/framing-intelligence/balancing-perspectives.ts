import { alignClaimsAcrossArticles } from "@/server/consensus/claim-alignment";
import { detectCrossArticleOmittedContext } from "@/server/consensus/omitted-context";
import type { AnalyzedArticleBundle } from "@/server/consensus/types";
import { hasBalancingPerspective } from "./markers";
import type {
  FramingDetectionFinding,
  OmittedBalancingPerspective,
} from "./types";
import { analyzeTextFramingSignals } from "./detect-signals";

export function detectOmittedBalancingPerspectives(
  articles: AnalyzedArticleBundle[],
): {
  omitted: OmittedBalancingPerspective[];
  findings: FramingDetectionFinding[];
} {
  const omitted: OmittedBalancingPerspective[] = [];
  const findings: FramingDetectionFinding[] = [];
  const alignedGroups = alignClaimsAcrossArticles(articles);
  const { items: omittedContext } = detectCrossArticleOmittedContext(articles, alignedGroups);

  const sourcesWithoutBalance: string[] = [];
  const sourcesWithBalance: string[] = [];

  for (const art of articles) {
    const text = `${art.title} ${art.analysisText}`.slice(0, 6000);
    const signals = analyzeTextFramingSignals(text);
    const polarized = signals.categoryScores.polarization >= 25;
    const intense = signals.framingIntensityScore >= 40;

    if (hasBalancingPerspective(text)) {
      sourcesWithBalance.push(art.sourceId);
    } else if (polarized || intense) {
      sourcesWithoutBalance.push(art.sourceId);
    }
  }

  if (sourcesWithoutBalance.length > 0 && sourcesWithBalance.length > 0) {
    omitted.push({
      description:
        "Some outlets include countervailing or qualifying perspectives; others present one-sided framing without balancing language.",
      affectedSourceIds: sourcesWithoutBalance,
      relatedOmittedContext: omittedContext.slice(0, 5),
      severity: sourcesWithoutBalance.length >= articles.length / 2 ? "warning" : "info",
    });
    findings.push({
      type: "omitted_balancing_perspective",
      severity: "warning",
      description: omitted[omitted.length - 1].description,
      sourceIds: sourcesWithoutBalance,
      examples: [],
    });
  } else if (sourcesWithoutBalance.length === articles.length && articles.length >= 2) {
    omitted.push({
      description:
        "No outlet in the cluster uses explicit balancing phrasing (critics/supporters, both sides, however opponents).",
      affectedSourceIds: sourcesWithoutBalance,
      relatedOmittedContext: omittedContext.slice(0, 5),
      severity: "warning",
    });
    findings.push({
      type: "omitted_balancing_perspective",
      severity: "warning",
      description: omitted[omitted.length - 1].description,
      sourceIds: sourcesWithoutBalance,
      examples: [],
    });
  }

  if (omittedContext.length > 0) {
    const crossOutlet = omittedContext.filter(
      (o) => (o.missingFromArticleIds?.length ?? 0) > 0 && (o.presentInArticleIds?.length ?? 0) >= 1,
    );
    if (crossOutlet.length > 0 && !omitted.some((o) => o.relatedOmittedContext?.length)) {
      omitted.push({
        description:
          "Context or claims present in some organizations are absent from others — balancing facts may be omitted.",
        affectedSourceIds: articles
          .filter((a) =>
            crossOutlet.some((o) => o.missingFromArticleIds?.includes(a.articleId)),
          )
          .map((a) => a.sourceId),
        relatedOmittedContext: crossOutlet.slice(0, 6),
        severity: "info",
      });
    }
  }

  return { omitted, findings };
}
