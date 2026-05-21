import type { ManualReport } from "@/lib/mock-data";
import type { AnalysisReport, ArticleSource, Claim, EvidenceItem } from "@/types/news-platform";
import type {
  Claim as MockClaim,
  Evidence as MockEvidence,
  Source as MockSource,
} from "@/lib/mock-data/types";

function toMockSource(s: ArticleSource): MockSource {
  const bias = s.bias === "unknown" ? "center" : s.bias;
  return {
    id: s.id,
    name: s.name,
    domain: s.domain,
    bias: bias as MockSource["bias"],
    reliability: s.reliability,
    approved: s.approved,
  };
}

function toMockEvidence(e: EvidenceItem): MockEvidence {
  return {
    id: e.id,
    sourceId: e.sourceId,
    excerpt: e.excerpt,
    supports: e.supports,
    url: e.url,
    citationLabel: e.citationLabel,
  };
}

function toMockClaim(
  c: Claim,
): MockClaim & {
  topicClassification?: Claim["topicClassification"];
  claimResearch?: Claim["claimResearch"];
  sourceChainTrace?: Claim["sourceChainTrace"];
  contradictionAnalysis?: Claim["contradictionAnalysis"];
  multiModelVerification?: Claim["multiModelVerification"];
  claimConsensus?: Claim["claimConsensus"];
} {
  return {
    id: c.id,
    text: c.text,
    verdict: c.verdict,
    confidence: c.confidence,
    evidence: c.evidence.map(toMockEvidence),
    context: c.context,
    reasoning: c.reasoning,
    topicClassification: c.topicClassification,
    claimResearch: c.claimResearch,
    sourceChainTrace: c.sourceChainTrace ?? c.claimResearch?.sourceChainTrace,
    contradictionAnalysis: c.contradictionAnalysis,
    multiModelVerification: c.multiModelVerification,
    claimConsensus: c.claimConsensus,
  };
}

/** Map platform AnalysisReport to UI ManualReport shape. */
export function analysisReportToManualReport(report: AnalysisReport): ManualReport {
  return {
    title: report.title,
    url: report.urlOrClusterId,
    overallConfidence: report.overallConfidence,
    summary: report.summary,
    claims: report.claims.map(toMockClaim),
    sources: report.sources.map(toMockSource),
  };
}
