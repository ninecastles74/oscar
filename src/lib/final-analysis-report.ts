import type {
  AnalysisExplainabilityBundle,
  AnalysisReport,
  ReliabilityScoreBundle,
  Verdict,
} from "@/types/news-platform";

export type FinalLabel = "Supported" | "Disputed" | "Unclear" | "Insufficient Evidence";

export type FinalAnalysisReport = {
  success: true;
  analysisId: string;
  article: {
    id: string;
    title: string;
    source: string;
    url: string;
  };
  summary: {
    finalLabel: FinalLabel;
    overallReliabilityScore: number;
    confidenceScore: number;
    uncertaintyLevel: number;
    shortExplanation: string;
    importantWarning?: string;
  };
  scoreBreakdown: {
    evidenceSupport: number;
    sourceIndependence: number;
    corroboration: number;
    contextCompleteness: number;
    contradictionRisk: number;
    narrativeIntensity: number;
    sourceTransparency: number;
  };
  claims: Array<{
    claimText: string;
    claimType: string;
    status: FinalLabel;
    confidenceScore: number;
    plainEnglishExplanation: string;
    supportingEvidence: Array<{ source: string; excerpt: string; url?: string }>;
    disputingEvidence: Array<{ source: string; excerpt: string; url?: string }>;
    warnings: string[];
  }>;
  whyThisScore: {
    plainEnglishSummary: string;
    mainReasonsScoreIncreased: string[];
    mainReasonsScoreDecreased: string[];
    missingEvidence: string[];
    sourceIndependenceExplanation: string;
    contradictionExplanation: string;
    narrativeExplanation: string;
  };
  metadata: {
    modelsUsed: string[];
    analysisStagesCompleted: string[];
    analysisStagesFailedOrLimited: string[];
    runtimeMs: number;
    reducedConfidence: boolean;
  };
};

function verdictLabel(v: Verdict): FinalLabel {
  switch (v) {
    case "supported":
      return "Supported";
    case "disputed":
      return "Disputed";
    case "unclear":
      return "Unclear";
    default:
      return "Insufficient Evidence";
  }
}

function overallLabel(report: AnalysisReport): FinalLabel {
  const counts = report.claims.reduce(
    (acc, c) => {
      acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<Verdict, number>>,
  );
  if ((counts.disputed ?? 0) > 0) return "Disputed";
  if ((counts.insufficient_evidence ?? 0) >= Math.ceil(report.claims.length / 2)) {
    return "Insufficient Evidence";
  }
  if ((counts.unclear ?? 0) > (counts.supported ?? 0)) return "Unclear";
  if ((counts.supported ?? 0) > 0) return "Supported";
  return "Insufficient Evidence";
}

function sourceName(report: AnalysisReport, sourceId: string): string {
  return report.sources.find((s) => s.id === sourceId)?.name ?? sourceId;
}

export function buildFinalAnalysisReport(input: {
  report: AnalysisReport;
  reliability?: ReliabilityScoreBundle;
  explainability?: AnalysisExplainabilityBundle;
  stagesCompleted?: string[];
  stagesFailedOrLimited?: string[];
}): FinalAnalysisReport {
  const { report, reliability, explainability } = input;
  const articleScore = reliability?.article;
  const reducedConfidence =
    (report.pipelineWarnings?.length ?? 0) > 0 ||
    report.claims.some((c) => c.verdict === "insufficient_evidence");

  const breakdown = explainability?.article?.categoryScores ?? [];
  const byId = (id: string) => breakdown.find((c) => c.categoryId === id)?.score ?? 0;

  const warning = report.pipelineWarnings?.[0]?.message;

  const increased: string[] = [];
  const decreased: string[] = [];
  const missing: string[] = [];

  if (byId("evidence_support") >= 60) {
    increased.push("Multiple claims are backed by direct or primary-style evidence.");
  } else {
    decreased.push("Evidence support is limited for several claims.");
  }
  if (byId("cross_source_corroboration") < 50) {
    decreased.push("Few independent outlets corroborate the same claims.");
    missing.push("Independent corroboration from separate reporting chains.");
  }
  if (byId("context_completeness") < 55) {
    decreased.push("Important context or timeline details may be missing.");
    missing.push("Additional context on timing, scope, or caveats.");
  }
  if ((report.issueSummary?.contradictions ?? 0) > 0) {
    decreased.push("Some claims conflict with other reported details.");
  }
  if ((report.issueSummary?.unsupportedClaims ?? 0) > 0) {
    missing.push("Verifiable support for one or more extracted claims.");
  }

  return {
    success: true,
    analysisId: report.id,
    article: {
      id: report.urlOrClusterId,
      title: report.title,
      source: report.sources[0]?.name ?? "Unknown source",
      url: report.urlOrClusterId.startsWith("http") ? report.urlOrClusterId : report.sources[0]?.domain ?? "",
    },
    summary: {
      finalLabel: overallLabel(report),
      overallReliabilityScore: articleScore?.overallScore ?? report.overallConfidence,
      confidenceScore: report.overallConfidence,
      uncertaintyLevel: Math.max(0, 100 - report.overallConfidence),
      shortExplanation: report.summary.slice(0, 500),
      importantWarning: reducedConfidence
        ? warning ??
          "Live evidence retrieval was temporarily limited, so OSCAR lowered confidence for some claims."
        : undefined,
    },
    scoreBreakdown: {
      evidenceSupport: byId("evidence_support") || report.overallConfidence,
      sourceIndependence: byId("cross_source_corroboration") || 50,
      corroboration: byId("cross_source_corroboration") || 50,
      contextCompleteness: byId("context_completeness") || 50,
      contradictionRisk: Math.max(0, 100 - (byId("contradiction_detection") || 70)),
      narrativeIntensity: Math.max(0, 100 - (byId("sensationalism") || 75)),
      sourceTransparency: byId("source_transparency") || 55,
    },
    claims: report.claims.map((c) => ({
      claimText: c.text,
      claimType: c.kind ?? "factual",
      status: verdictLabel(c.verdict),
      confidenceScore: c.confidence,
      plainEnglishExplanation:
        c.reasoning ??
        c.context ??
        "This claim was evaluated using evidence-weighted corroboration across available sources.",
      supportingEvidence: c.evidence
        .filter((e) => e.supports)
        .map((e) => ({
          source: sourceName(report, e.sourceId),
          excerpt: e.excerpt,
          url: e.url,
        })),
      disputingEvidence: c.evidence
        .filter((e) => !e.supports)
        .map((e) => ({
          source: sourceName(report, e.sourceId),
          excerpt: e.excerpt,
          url: e.url,
        })),
      warnings: c.context ? [c.context] : [],
    })),
    whyThisScore: {
      plainEnglishSummary:
        explainability?.article?.whyScoreExists ??
        "This score reflects evidence-weighted reliability — how well claims are supported, corroborated, and contextualized — not a declaration of absolute truth.",
      mainReasonsScoreIncreased: increased,
      mainReasonsScoreDecreased: decreased,
      missingEvidence: missing,
      sourceIndependenceExplanation:
        "OSCAR checks whether multiple outlets independently verify a claim, not whether many sites repeat the same origin story.",
      contradictionExplanation:
        (report.issueSummary?.contradictions ?? 0) > 0
          ? `${report.issueSummary?.contradictions} claim(s) show contradictions or conflicting details across sources.`
          : "No major cross-source contradictions were detected in the extracted claims.",
      narrativeExplanation:
        (report.issueSummary?.emotionalLanguage ?? 0) > 0
          ? "Some sensational or emotional framing was detected; this can increase uncertainty."
          : "Framing intensity appears moderate based on extracted language signals.",
    },
    metadata: {
      modelsUsed: report.multiModelVerification?.modelsUsed ?? [],
      analysisStagesCompleted: input.stagesCompleted ?? [],
      analysisStagesFailedOrLimited: input.stagesFailedOrLimited ?? [],
      runtimeMs: report.processingTimeMs ?? 0,
      reducedConfidence,
    },
  };
}
