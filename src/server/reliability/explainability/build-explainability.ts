import type {
  AnalysisReport,
  ArticleReliabilityScore,
  AuthorReliabilityScore,
  ExplainabilityEvidenceItem,
  ExplainableEntityType,
  OrganizationReliabilityScore,
  ReliabilityCategoryScore,
  ReliabilityScoreBundle,
  ScoreAppliedPenalties,
  ScoreCalculationStep,
  ScoreExplainability,
  CorroboratingSourceEntry,
  ContradictionHistoryEntry,
  HistoricalScoreChange,
  OmittedContextEntry,
} from "@/types/news-platform";
import { RELIABILITY_SCORING_DISCLAIMER } from "@/types/news-platform";
import type { VerificationPipelineResults } from "../../analysis/verification/types";
import { computeConfidenceMetrics } from "../calculators/confidence";
import { getArticleScores, getAuthorScores, getOrganizationScores } from "../store";
import { queryHistoricalSnapshots } from "../historical/snapshot-store";
import { APPROVED_SOURCES } from "../../analysis/sources";

function sourceName(sourceId: string, report: AnalysisReport): string {
  return report.sources.find((s) => s.id === sourceId)?.name ?? sourceId;
}

function extractEvidence(report: AnalysisReport): {
  supporting: ExplainabilityEvidenceItem[];
  disputed: ExplainabilityEvidenceItem[];
} {
  const supporting: ExplainabilityEvidenceItem[] = [];
  const disputed: ExplainabilityEvidenceItem[] = [];

  for (const claim of report.claims) {
    for (const e of claim.evidence) {
      const item: ExplainabilityEvidenceItem = {
        id: e.id,
        claimId: claim.id,
        claimText: claim.text,
        sourceId: e.sourceId,
        sourceName: e.sourceName ?? sourceName(e.sourceId, report),
        stance: e.stance ?? (e.supports ? "support" : "contradict"),
        excerpt: e.excerpt,
        url: e.url,
        citationLabel: e.citationLabel,
        verdict: claim.verdict,
      };
      if (item.stance === "support" || e.supports) {
        supporting.push(item);
      } else if (item.stance === "contradict" || !e.supports) {
        disputed.push(item);
      }
    }
    if (claim.verdict === "disputed") {
      for (const e of claim.evidence.filter((ev) => ev.supports)) {
        if (!disputed.some((d) => d.id === e.id)) {
          disputed.push({
            id: e.id,
            claimId: claim.id,
            claimText: claim.text,
            sourceId: e.sourceId,
            sourceName: e.sourceName ?? sourceName(e.sourceId, report),
            stance: "support",
            excerpt: e.excerpt,
            url: e.url,
            citationLabel: e.citationLabel,
            verdict: "disputed",
          });
        }
      }
    }
  }

  return { supporting, disputed };
}

function buildCorroboratingSources(report: AnalysisReport): CorroboratingSourceEntry[] {
  const bySource = new Map<string, CorroboratingSourceEntry>();

  for (const comp of report.sourceComparisons ?? []) {
    for (const sr of comp.sourceReports) {
      if (sr.stance !== "support") continue;
      const existing = bySource.get(sr.sourceId) ?? {
        sourceId: sr.sourceId,
        sourceName: sr.sourceName,
        domain: report.sources.find((s) => s.id === sr.sourceId)?.domain,
        agreementScore: comp.agreementScore,
        supportingClaims: 0,
        excerpts: [],
      };
      existing.supportingClaims += 1;
      if (sr.excerpt) existing.excerpts.push(sr.excerpt.slice(0, 200));
      existing.agreementScore = Math.max(existing.agreementScore ?? 0, comp.agreementScore);
      bySource.set(sr.sourceId, existing);
    }
  }

  return [...bySource.values()].sort((a, b) => (b.agreementScore ?? 0) - (a.agreementScore ?? 0));
}

function buildContradictionHistory(
  report: AnalysisReport,
  results?: VerificationPipelineResults,
): ContradictionHistoryEntry[] {
  const entries: ContradictionHistoryEntry[] = [];
  const recordedAt = report.generatedAt;

  for (const comp of report.sourceComparisons ?? []) {
    for (const c of comp.contradictions ?? []) {
      entries.push({
        claimId: comp.claimId,
        claimText: comp.claimText,
        description: c.description,
        severity: c.severity,
        sourceIds: [...c.sourceIds],
        sourceNames: c.sourceIds.map((id) => sourceName(id, report)),
        recordedAt,
      });
    }
  }

  if (results) {
    for (const c of results.contradictions) {
      if (entries.some((e) => e.claimId === c.claimId && e.description === c.description)) continue;
      const claim = report.claims.find((cl) => cl.id === c.claimId);
      entries.push({
        claimId: c.claimId,
        claimText: claim?.text ?? c.claimId,
        description: c.description,
        severity: c.severity,
        sourceIds: [...c.sourceIds],
        sourceNames: c.sourceIds.map((id) => sourceName(id, report)),
        recordedAt,
      });
    }
  }

  return entries;
}

function buildOmittedContext(
  report: AnalysisReport,
  results?: VerificationPipelineResults,
): OmittedContextEntry[] {
  const entries: OmittedContextEntry[] = [];

  for (const claim of report.claims) {
    if (claim.context) {
      entries.push({
        claimId: claim.id,
        claimText: claim.text,
        description: claim.context,
        severity: "warning",
      });
    }
  }

  for (const flag of report.issueFlags ?? []) {
    if (flag.type === "missing_context") {
      const claim = report.claims.find((c) => c.id === flag.claimId);
      if (!entries.some((e) => e.claimId === flag.claimId)) {
        entries.push({
          claimId: flag.claimId,
          claimText: claim?.text ?? flag.claimId,
          description: flag.description,
          severity: flag.severity,
        });
      }
    }
  }

  if (results) {
    for (const m of results.missingContext) {
      if (entries.some((e) => e.claimId === m.claimId && e.description === m.description)) continue;
      const claim = report.claims.find((c) => c.id === m.claimId);
      entries.push({
        claimId: m.claimId,
        claimText: claim?.text ?? m.claimId,
        description: m.description,
        severity: "info",
      });
    }
  }

  return entries;
}

function buildCalculationSteps(categories: ReliabilityCategoryScore[]): ScoreCalculationStep[] {
  return categories.map((cat) => {
    const contribution = Math.round(cat.score * cat.weight * 10) / 10;
    return {
      categoryId: cat.id,
      label: cat.label,
      score: cat.score,
      weight: cat.weight,
      weightPercent: Math.round(cat.weight * 100),
      contribution,
      description: cat.description,
      formulaSummary: `${cat.label}: ${cat.score}/100 × ${Math.round(cat.weight * 100)}% weight → +${contribution} pts to composite`,
    };
  });
}

function buildWeightedFormula(categories: ReliabilityCategoryScore[]): string {
  const parts = categories.map(
    (c) => `(${c.score} × ${c.weight.toFixed(2)})`,
  );
  return `Overall = ${parts.join(" + ")} ≈ ${Math.round(categories.reduce((s, c) => s + c.score * c.weight, 0))}`;
}

function buildHistoricalChanges(
  entityType: ExplainableEntityType,
  entityId: string,
  versions: { version: number; computedAt: string; overallScore: number }[],
): HistoricalScoreChange[] {
  return versions.map((v, i) => {
    const prev = i > 0 ? versions[i - 1].overallScore : null;
    const delta = prev !== null ? Math.round((v.overallScore - prev) * 10) / 10 : null;
    const snapshots = queryHistoricalSnapshots({
      entityType: entityType === "source" ? "source" : entityType,
      entityId,
      metricType: "overall_score",
      limit: 50,
    });
    void snapshots.find((s) => s.recordedAt === v.computedAt);
    return {
      version: v.version,
      recordedAt: v.computedAt,
      overallScore: v.overallScore,
      delta,
      summary:
        delta === null
          ? "Initial score for this entity."
          : delta > 0
            ? `Score increased by ${delta} after new evidence or recalculation.`
            : delta < 0
              ? `Score decreased by ${Math.abs(delta)} due to contradictions, missing context, or weaker corroboration.`
              : "Score unchanged after recalculation.",
    };
  });
}

function buildConfidenceExplanation(
  report: AnalysisReport,
  article: ArticleReliabilityScore,
  penalties?: ScoreAppliedPenalties,
): string {
  const metrics = computeConfidenceMetrics(report.claims);
  const parts = [
    `Mean claim confidence is ${metrics.avgClaimConfidence}% across ${report.claims.length} extracted claim(s).`,
    `${Math.round(metrics.supportedRatio * 100)}% of claims are Supported, ${Math.round(metrics.disputedRatio * 100)}% Disputed, ${Math.round(metrics.insufficientRatio * 100)}% Insufficient Evidence.`,
    `Verification overall confidence (separate from reliability) is ${report.overallConfidence}%.`,
  ];
  if (article.avgClaimConfidence !== undefined) {
    parts.push(`Reliability evidence_support category incorporates this average (${article.avgClaimConfidence}%).`);
  }
  if (penalties) {
    if (penalties.contradictionPenalty > 0) {
      parts.push(`Contradiction penalty applied: −${penalties.contradictionPenalty} points to contradiction_detection.`);
    }
    if (penalties.insufficientEvidencePenalty > 0) {
      parts.push(`Insufficient-evidence penalty: −${penalties.insufficientEvidencePenalty} points.`);
    }
  }
  return parts.join(" ");
}

function buildAiReasoningSummary(
  report: AnalysisReport,
  entityLabel: string,
  entityType: ExplainableEntityType,
): string {
  const topClaims = report.claims
    .filter((c) => c.reasoning)
    .slice(0, 3)
    .map((c) => `• ${c.text.slice(0, 120)}… — ${c.reasoning}`)
    .join("\n");

  const issue = report.issueSummary;
  return [
    `Analysis for ${entityLabel} (${entityType} reliability).`,
    report.summary,
    issue.contradictions > 0
      ? `${issue.contradictions} contradiction(s) detected across approved sources.`
      : "No cross-source contradictions flagged.",
    issue.missingContext > 0
      ? `${issue.missingContext} claim(s) missing important context in cited material.`
      : null,
    topClaims ? `Key claim reasoning:\n${topClaims}` : null,
    "Scores reflect cited evidence only — not a determination of objective truth.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildWhyScoreExists(
  entityType: ExplainableEntityType,
  entityLabel: string,
  score: number,
): string {
  const entityNames = {
    article: "article reliability",
    source: "source (publisher) reliability",
    author: "author reliability",
  };
  return (
    `This ${entityNames[entityType]} score (${score}/100) for "${entityLabel}" summarizes ` +
    `evidence-weighted signals from the verification pipeline: supporting and disputed citations, ` +
    `cross-source agreement, contradiction frequency, sensationalism indicators, and source transparency. ` +
    `It is not a verdict on whether the underlying story is true.`
  );
}

function buildHowCalculated(entityType: ExplainableEntityType): string {
  if (entityType === "article") {
    return (
      "Six weighted categories are scored 0–100 from verification outputs, then combined into an overall score. " +
      "Penalties reduce contradiction_detection and sensationalism when issues are detected. " +
      "Each category has a documented weight (summing to 100%)."
    );
  }
  if (entityType === "source") {
    return (
      "Source reliability rolls up article-level category scores over time using a rolling window. " +
      "Reporting consistency blends context and corroboration categories; contradiction frequency is derived from contradiction_detection."
    );
  }
  return (
    "Author reliability aggregates article scores attributed to this author, with rolling averages for reporting consistency and corroboration confidence."
  );
}

export interface BuildExplainabilityInput {
  entityType: ExplainableEntityType;
  entityId: string;
  report: AnalysisReport;
  bundle: ReliabilityScoreBundle;
  results?: VerificationPipelineResults;
}

export function buildArticleExplainability(
  input: BuildExplainabilityInput,
): ScoreExplainability {
  const article = input.bundle.article;
  const { supporting, disputed } = extractEvidence(input.report);
  const categories = article.categories;
  const versions = getArticleScores(article.articleId);

  return {
    entityType: "article",
    entityId: article.articleId,
    entityLabel: article.title,
    overallScore: article.overallScore,
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    whyScoreExists: buildWhyScoreExists("article", article.title, article.overallScore),
    howCalculated: buildHowCalculated("article"),
    weightedFormula: buildWeightedFormula(categories),
    calculationSteps: buildCalculationSteps(categories),
    supportingEvidence: supporting,
    disputedEvidence: disputed,
    corroboratingSources: buildCorroboratingSources(input.report),
    contradictionHistory: buildContradictionHistory(input.report, input.results),
    omittedContext: buildOmittedContext(input.report, input.results),
    aiReasoningSummary: buildAiReasoningSummary(input.report, article.title, "article"),
    confidenceExplanation: buildConfidenceExplanation(
      input.report,
      article,
      article.appliedPenalties,
    ),
    appliedPenalties: article.appliedPenalties,
    historicalChanges: buildHistoricalChanges(
      "article",
      article.articleId,
      versions.map((v) => ({
        version: v.version,
        computedAt: v.computedAt,
        overallScore: v.overallScore,
      })),
    ),
    reportId: article.reportId,
    articleId: article.articleId,
  };
}

export function buildSourceExplainability(
  input: BuildExplainabilityInput,
  organization: OrganizationReliabilityScore,
): ScoreExplainability {
  const { supporting, disputed } = extractEvidence(input.report);
  const orgSources = new Set(
    APPROVED_SOURCES.filter(
      (s) => s.id === organization.organizationId || s.domain === organization.domain,
    ).map((s) => s.id),
  );
  const filterByOrg = (e: ExplainabilityEvidenceItem) =>
    orgSources.size === 0 || orgSources.has(e.sourceId);

  const versions = getOrganizationScores(organization.organizationId);
  const categories: ReliabilityCategoryScore[] = [
    {
      id: "context_completeness",
      label: "Reporting Consistency",
      score: organization.reportingConsistency,
      weight: 0.35,
      description: "Blend of context completeness and cross-source corroboration from scored articles.",
    },
    {
      id: "cross_source_corroboration",
      label: "Corroboration Confidence",
      score: organization.corroborationConfidence,
      weight: 0.35,
      description: "Agreement across approved outlets when this source is cited.",
    },
    {
      id: "source_transparency",
      label: "Source Transparency",
      score: organization.sourceTransparency,
      weight: 0.15,
      description: "Attribution, citations, and declared content rights.",
    },
    {
      id: "contradiction_detection",
      label: "Contradiction Detection",
      score: 100 - organization.contradictionFrequency,
      weight: 0.15,
      description: "Inverse of how often contradictions appear in material citing this source.",
    },
  ];

  return {
    entityType: "source",
    entityId: organization.organizationId,
    entityLabel: organization.name,
    overallScore: organization.overallScore,
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    whyScoreExists: buildWhyScoreExists("source", organization.name, organization.overallScore),
    howCalculated: buildHowCalculated("source"),
    weightedFormula: `Rolling average over ${organization.articlesScored} scored article(s); current rolling = ${organization.rollingAverage}`,
    calculationSteps: buildCalculationSteps(categories),
    supportingEvidence: supporting.filter(filterByOrg),
    disputedEvidence: disputed.filter(filterByOrg),
    corroboratingSources: buildCorroboratingSources(input.report).filter((c) =>
      orgSources.size === 0 ? true : orgSources.has(c.sourceId),
    ),
    contradictionHistory: buildContradictionHistory(input.report, input.results).filter((c) =>
      c.sourceIds.some((id) => orgSources.size === 0 || orgSources.has(id)),
    ),
    omittedContext: buildOmittedContext(input.report, input.results),
    aiReasoningSummary: buildAiReasoningSummary(
      input.report,
      organization.name,
      "source",
    ),
    confidenceExplanation: `Source corroboration confidence is ${organization.corroborationConfidence}%. Contradiction frequency index: ${organization.contradictionFrequency} (lower is better). Trend: ${organization.trend.direction} over ${organization.trend.sampleSize} sample(s).`,
    historicalChanges: buildHistoricalChanges(
      "source",
      organization.organizationId,
      versions.map((v) => ({
        version: 0,
        computedAt: v.computedAt,
        overallScore: v.overallScore,
      })),
    ),
    reportId: input.bundle.article.reportId,
    articleId: input.bundle.article.articleId,
  };
}

export function buildAuthorExplainability(
  input: BuildExplainabilityInput,
  author: AuthorReliabilityScore,
): ScoreExplainability {
  const { supporting, disputed } = extractEvidence(input.report);
  const versions = getAuthorScores(author.authorId);
  const categories: ReliabilityCategoryScore[] = [
    {
      id: "cross_source_corroboration",
      label: "Corroboration Confidence",
      score: author.corroborationConfidence,
      weight: 0.5,
      description: "Cross-source agreement on claims in articles attributed to this author.",
    },
    {
      id: "context_completeness",
      label: "Reporting Consistency",
      score: author.reportingConsistency,
      weight: 0.5,
      description: "Context completeness and framing consistency across scored articles.",
    },
  ];

  return {
    entityType: "author",
    entityId: author.authorId,
    entityLabel: author.displayName,
    overallScore: author.overallScore,
    disclaimer: RELIABILITY_SCORING_DISCLAIMER,
    whyScoreExists: buildWhyScoreExists("author", author.displayName, author.overallScore),
    howCalculated: buildHowCalculated("author"),
    weightedFormula: `Rolling average over ${author.articlesScored} scored article(s); current rolling = ${author.rollingAverage}`,
    calculationSteps: buildCalculationSteps(categories),
    supportingEvidence: supporting,
    disputedEvidence: disputed,
    corroboratingSources: buildCorroboratingSources(input.report),
    contradictionHistory: buildContradictionHistory(input.report, input.results),
    omittedContext: buildOmittedContext(input.report, input.results),
    aiReasoningSummary: buildAiReasoningSummary(input.report, author.displayName, "author"),
    confidenceExplanation: `Author corroboration confidence: ${author.corroborationConfidence}%. Reporting consistency: ${author.reportingConsistency}%. Trend: ${author.trend.direction}.`,
    historicalChanges: buildHistoricalChanges(
      "author",
      author.authorId,
      versions.map((v) => ({
        version: 0,
        computedAt: v.computedAt,
        overallScore: v.overallScore,
      })),
    ),
    reportId: input.bundle.article.reportId,
    articleId: input.bundle.article.articleId,
  };
}

export function buildScoreExplainability(input: BuildExplainabilityInput): ScoreExplainability {
  switch (input.entityType) {
    case "article":
      return buildArticleExplainability(input);
    case "source": {
      const org = input.bundle.organization;
      if (!org) throw new Error("No organization score available for source explainability");
      return buildSourceExplainability(input, org);
    }
    case "author": {
      const author = input.bundle.author;
      if (!author) throw new Error("No author score available for author explainability");
      return buildAuthorExplainability(input, author);
    }
    default:
      return buildArticleExplainability(input);
  }
}

export function buildFullExplainabilityBundle(
  report: AnalysisReport,
  bundle: ReliabilityScoreBundle,
  results?: VerificationPipelineResults,
): {
  article: ScoreExplainability;
  source: ScoreExplainability | null;
  author: ScoreExplainability | null;
} {
  const base = { report, bundle, results };
  return {
    article: buildArticleExplainability({ ...base, entityType: "article", entityId: bundle.article.articleId }),
    source: bundle.organization
      ? buildSourceExplainability(
          { ...base, entityType: "source", entityId: bundle.organization.organizationId },
          bundle.organization,
        )
      : null,
    author: bundle.author
      ? buildAuthorExplainability(
          { ...base, entityType: "author", entityId: bundle.author.authorId },
          bundle.author,
        )
      : null,
  };
}
