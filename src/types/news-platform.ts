// =============================================================================
// OSCAR — Core Platform Types
// =============================================================================
// These types model the full automatic + manual news-analysis pipeline.
// Every field is documented; optional fields are marked with `?`.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared / Primitive Types
// ---------------------------------------------------------------------------

/**
 * Per-claim verification labels only (never applied to whole articles).
 * Display: Supported | Disputed | Unclear | Insufficient Evidence
 */
export type Verdict = "supported" | "disputed" | "unclear" | "insufficient_evidence";

/** @deprecated Use Verdict. Kept for migration references. */
export type LegacyVerdict = "supported" | "disputed" | "unverified" | "false";

/** How a piece of evidence relates to a claim. */
export type EvidenceStance = "support" | "contradict" | "neutral";

/** Political bias indicator for a news source. */
export type Bias = "left" | "center-left" | "center" | "center-right" | "right" | "unknown";

/** Category tags for news stories. */
export type Category =
  | "Politics"
  | "World"
  | "Business"
  | "Technology"
  | "Science"
  | "Health"
  | "Climate"
  | "Markets"
  | "Sports"
  | "Entertainment"
  | "General";

/** AI content taxonomy for articles and claims (multi-topic). */
export type ContentTopic =
  | "Politics"
  | "Finance"
  | "Science"
  | "Health"
  | "Technology"
  | "International"
  | "Crime"
  | "Entertainment"
  | "Sports";

export const CONTENT_TOPICS: readonly ContentTopic[] = [
  "Politics",
  "Finance",
  "Science",
  "Health",
  "Technology",
  "International",
  "Crime",
  "Entertainment",
  "Sports",
] as const;

/** Single topic label with model confidence 0–100. */
export interface ClassifiedTopic {
  topic: ContentTopic;
  confidence: number;
}

/** Multi-topic classification result for an article or claim. */
export interface TopicClassification {
  topics: ClassifiedTopic[];
  primaryTopic: ContentTopic;
  primaryConfidence: number;
  /** Classifier version / method for audit. */
  classifier: "keyword" | "llm" | "hybrid";
}

/** Per-topic reliability rollup for a news source. */
export interface TopicSourceReliability {
  topic: ContentTopic;
  organizationId: string;
  name: string;
  domain: string;
  overallScore: number;
  rollingAverage: number;
  corroborationConfidence: number;
  reportingConsistency: number;
  articlesScored: number;
  computedAt: string;
}

/** Detected issue types during analysis. */
export type IssueType =
  | "contradiction"
  | "missing_context"
  | "emotional_language"
  | "unsupported_claim";

/** API providers supported by the automatic fetch pipeline. */
export type ApiProviderId = "newsapi" | "gnews" | "guardian" | "nyt" | "rss" | "publishers";

// ---------------------------------------------------------------------------
// 1. ArticleSource — describes a publisher/outlet
// ---------------------------------------------------------------------------

export interface ArticleSource {
  /** Unique identifier (e.g., "s1", "reuters"). */
  id: string;

  /** Human-readable name (e.g., "Reuters"). */
  name: string;

  /** Root domain without protocol (e.g., "reuters.com"). */
  domain: string;

  /** Political bias classification. */
  bias: Bias;

  /** Reliability score 0–100. Higher = more trustworthy. */
  reliability: number;

  /** Whether the source is approved for inclusion in analyses. */
  approved: boolean;

  /** ISO country code of primary operation (e.g., "US", "GB"). */
  country?: string;

  /** Primary language (e.g., "en", "es"). */
  language?: string;

  /** Year established, if known. */
  foundedYear?: number;

  /** Brief description of the outlet. */
  description?: string;

  /** URL to logo image. */
  logoUrl?: string;
}

// ---------------------------------------------------------------------------
// 2. NewsArticle — a single article, normalized from any upstream feed
// ---------------------------------------------------------------------------

export interface NewsArticle {
  /** Unique article ID (stable across deduplication). */
  id: string;

  /** Article headline / title. */
  title: string;

  /** Backward-compatible alias for `title` used in legacy components. */
  headline?: string;

  /** Short description or lead paragraph. */
  description: string;

  /** Canonical URL to the article. */
  url: string;

  /** Source name (e.g., "Reuters"). */
  sourceName: string;

  /** Source domain (e.g., "reuters.com"). */
  sourceDomain: string;

  /** Backward-compatible source ID reference used in legacy components. */
  sourceId?: string;

  /** Author name(s); may be multiple or unknown. */
  author?: string;

  /** ISO 8601 publish date. */
  publishedAt: string;

  /** Image URL — only populated if legally usable (open license or fair-use safe). */
  imageUrl?: string;

  /** Which API / feed this article was fetched from. */
  originalApiProvider: ApiProviderId | string;

  /** Story category. */
  category: Category;

  /** ISO country code related to the story. */
  country?: string;

  /** Article language code (e.g., "en"). */
  language: string;

  /** Full article text, if available via scrape or API body. */
  fullText?: string;

  /** Word count of full text, if known. */
  wordCount?: number;

  /** Cluster this article belongs to (set during clustering stage). */
  clusterId?: string;

  /** Whether this article was marked a duplicate and merged. */
  isDuplicate?: boolean;

  /** SHA-256 hash of normalized content for deduplication. */
  contentHash?: string;

  /**
   * Feed-safe summary and rights metadata (RSS / licensed ingest).
   * Full article text is omitted unless `ingestMetadata.contentPolicy` allows it.
   */
  ingestMetadata?: ArticleIngestMetadata;

  /**
   * Claims extracted from coverage. Empty at RSS ingest; populated by the analysis pipeline.
   */
  extractedClaims?: string[];
}

/** How ingested body text may be stored. */
export type ArticleContentPolicy = "feed_summary_only" | "licensed_full_text";

/** Provenance for images attached to an article. */
export type ArticleImageSource = "media_thumbnail" | "media_content" | "enclosure" | "none";

/**
 * Server-side ingest metadata — URL, summary, rights, and claim placeholders.
 */
export interface ArticleIngestMetadata {
  /** Registry feed id (e.g. `bbc-world`). */
  feedId: string;

  /** RSS/Atom feed URL this article was fetched from. */
  feedUrl: string;

  /** Summary stored for display (truncated feed description; not full article text). */
  summary: string;

  /** Whether full text may be stored on the article record. */
  contentPolicy: ArticleContentPolicy;

  /** How the summary was derived. */
  summarySource: "rss_description" | "rss_summary" | "title_fallback";

  /** Image provenance when `imageUrl` is set. */
  imageSource?: ArticleImageSource;

  /** Optional rights / licensing note for auditors. */
  rightsNote?: string;

  /** True when claim extraction has not run yet. */
  claimsPending?: boolean;
}

// ---------------------------------------------------------------------------
// 3. StoryCluster — group of articles covering the same event
// ---------------------------------------------------------------------------

export interface StoryCluster {
  /** Unique cluster ID. */
  id: string;

  /** Representative headline (from highest-ranked article). */
  title: string;

  /** AI-generated summary of the event. */
  summary: string;

  /** Primary category. */
  category: Category;

  /** Number of articles in the cluster. */
  storyCount: number;

  /** Overall confidence 0–100 (cross-source agreement). */
  confidence: number;

  /** How many claims within this cluster are disputed. */
  disputedClaims: number;

  /** How many claims are flagged for missing context. */
  missingContext: number;

  /** ISO 8601 timestamp of the latest article in the cluster. */
  publishedAt: string;

  /** Hero image from the lead article or best available member with `imageUrl`. */
  imageUrl?: string;

  /** IDs of articles in this cluster (canonical name). */
  articleIds?: string[];

  /** Backward-compatible alias for `articleIds` used in legacy components. */
  storyIds?: string[];

  /** IDs of extracted claims. */
  claimIds: string[];

  /** Trending / relevance score for ranking. */
  trendingScore: number;

  /** Lead outlet name (canonical publisher). */
  primarySourceName?: string;

  /** Unique outlet names in this cluster. */
  sourceNames?: string[];

  /** Source diversity metric (unique domains / total articles). */
  sourceDiversity?: number;

  /** Geographic scope of coverage. */
  geographicScope?: string[];
}

// ---------------------------------------------------------------------------
// 4. Claim — a verifiable factual statement extracted from coverage
// ---------------------------------------------------------------------------

export interface Claim {
  /** Unique claim ID. */
  id: string;

  /** The claim text itself. */
  text: string;

  /** AI verdict after cross-referencing evidence. */
  verdict: Verdict;

  /** Confidence 0–100. */
  confidence: number;

  /** Evidence items supporting or disputing this claim. */
  evidence: EvidenceItem[];

  /** Optional note on missing context that changes interpretation. */
  context?: string;

  /** Which cluster this claim belongs to. */
  clusterId?: string;

  /** AI-generated explanation of the verdict. */
  reasoning?: string;

  /** Multi-topic AI classification with confidence scores. */
  topicClassification?: TopicClassification;

  /** Deep research scores and sourcing analysis. */
  claimResearch?: ClaimResearchReport;

  /** Source-chain trace: origin, dependencies, independence. */
  sourceChainTrace?: SourceChainTraceReport;

  /** Full contradiction analysis for this claim. */
  contradictionAnalysis?: ContradictionAnalysisReport;

  /** Multi-model verification consensus (OpenAI → Claude → Gemini). */
  multiModelVerification?: MultiModelClaimVerification;

  /** Final consensus across evidence, AI, independence, contradiction, corroboration, reliability. */
  claimConsensus?: ClaimConsensusReport;
}

// ---------------------------------------------------------------------------
// Claim consensus engine (evidence-weighted — not objective truth)
// ---------------------------------------------------------------------------

export type ConsensusSignalDimension =
  | "evidence_quality"
  | "ai_reasoning"
  | "source_independence"
  | "contradiction_analysis"
  | "corroboration"
  | "historical_reliability";

export interface ConsensusSignalContribution {
  dimension: ConsensusSignalDimension;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  narrative: string;
}

export interface ClaimConsensusReport {
  claimId: string;
  claimText: string;
  verdict: Verdict;
  /** Epistemic confidence in the label (0–100), not a truth probability. */
  confidence: number;
  compositeScore: number;
  signals: ConsensusSignalContribution[];
  reasoning: string;
  disclaimers: readonly string[];
  computedAt: string;
}

export interface ClaimConsensusBatchReport {
  articleId: string;
  claims: ClaimConsensusReport[];
  verdictBreakdown: Record<Verdict, number>;
  overallConfidence: number;
  summary: string;
  disclaimers: readonly string[];
  computedAt: string;
}

/** Product copy: consensus never asserts objective truth. */
export const CLAIM_CONSENSUS_DISCLAIMERS = [
  "Labels describe evidence-weighted consensus among signals — not objective truth.",
  "Supported means corroboration outweighs dispute in available material, not that a claim is proven.",
  "Disputed means material conflict or weak sourcing was detected, not that a claim is false.",
] as const;

// ---------------------------------------------------------------------------
// Multi-model claim verification
// ---------------------------------------------------------------------------

export type ModelProviderId = "openai" | "anthropic" | "google";

export type ModelVerificationRole = "primary" | "review" | "corroboration";

export type ArbitrationMethod =
  | "unanimous"
  | "weighted_majority"
  | "review_mediator"
  | "primary_override"
  | "evidence_fallback";

export interface ModelClaimVerdict {
  provider: ModelProviderId;
  model: string;
  role: ModelVerificationRole;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface ModelDisagreement {
  claimId: string;
  providers: ModelProviderId[];
  verdicts: Verdict[];
  confidenceSpread: number;
  description: string;
  severity: "minor" | "significant" | "fundamental";
}

export interface MultiModelConsensus {
  finalVerdict: Verdict;
  finalConfidence: number;
  arbitrationMethod: ArbitrationMethod;
  disagreementDetected: boolean;
  modelVerdicts: ModelClaimVerdict[];
  disagreements: ModelDisagreement[];
  consensusSummary: string;
}

export interface MultiModelClaimVerification {
  claimId: string;
  claimText: string;
  consensus: MultiModelConsensus;
  stagesRun: string[];
  computedAt: string;
}

export interface MultiModelVerificationReport {
  articleId: string;
  claims: MultiModelClaimVerification[];
  overallConfidence: number;
  disagreementCount: number;
  modelsUsed: ModelProviderId[];
  summary: string;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Contradiction analysis engine
// ---------------------------------------------------------------------------

export type ContradictionIssueType =
  | "claim_evidence_mismatch"
  | "article_reporting_conflict"
  | "conflicting_reporting"
  | "omitted_context"
  | "timeline_inconsistency"
  | "unsupported_causal_claim"
  | "unsupported_statistic"
  | "emotional_exaggeration";

export interface ContradictionIssue {
  issueId: string;
  type: ContradictionIssueType;
  claimId: string;
  description: string;
  severity: "minor" | "significant" | "fundamental" | "info" | "warning" | "critical";
  evidenceIds?: string[];
  sourceIds?: string[];
  articleIds?: string[];
}

export interface ClaimEvidenceConflict {
  claimId: string;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  neutralEvidenceIds: string[];
  description: string;
  severity: "minor" | "significant" | "fundamental";
}

export interface ArticleReportingDifference {
  claimId: string;
  sourceA: string;
  sourceB: string;
  sourceAName: string;
  sourceBName: string;
  differenceType: "stance" | "framing" | "emphasis" | "factual";
  description: string;
  articleIds?: string[];
}

export interface ConflictingReportingFinding {
  claimId: string;
  description: string;
  supportingSources: string[];
  contradictingSources: string[];
  severity: "minor" | "significant" | "fundamental";
}

export interface OmittedContextFinding {
  claimId: string;
  description: string;
  missingAspects: string[];
  evidenceIds: string[];
  severity: "info" | "warning" | "critical";
}

export interface TimelineInconsistency {
  claimId: string;
  description: string;
  datesMentioned: string[];
  conflictingSources: string[];
  severity: "warning" | "critical";
}

export interface UnsupportedCausalClaim {
  claimId: string;
  claimText: string;
  causalPhrases: string[];
  description: string;
  evidenceIds: string[];
  severity: "warning" | "critical";
}

export interface UnsupportedStatisticFinding {
  claimId: string;
  statisticPhrases: string[];
  description: string;
  evidenceIds: string[];
  severity: "warning" | "critical";
}

export interface EmotionalExaggerationFinding {
  claimId: string;
  intensityScore: number;
  dominantTones: string[];
  markerExamples: string[];
  description: string;
  sourceIds: string[];
  severity: "info" | "warning" | "critical";
}

export interface ContradictionAnalysisReport {
  claimId: string;
  claimText: string;
  issues: ContradictionIssue[];
  claimEvidenceConflicts: ClaimEvidenceConflict[];
  articleDifferences: ArticleReportingDifference[];
  conflictingReporting: ConflictingReportingFinding[];
  omittedContext: OmittedContextFinding[];
  timelineInconsistencies: TimelineInconsistency[];
  unsupportedCausalClaims: UnsupportedCausalClaim[];
  unsupportedStatistics?: UnsupportedStatisticFinding[];
  emotionalExaggeration?: EmotionalExaggerationFinding[];
  framingIntensityScore?: number;
  contradictionScore: number;
  analysisSummary: string;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Claim research engine
// ---------------------------------------------------------------------------

export type EvidenceTier = "primary" | "secondary" | "derivative";

export interface ResearchEvidence extends EvidenceItem {
  tier: EvidenceTier;
  reliabilityWeight: number;
  evidenceType: EvidenceDocumentType;
  dynamicWeight: number;
  weightBreakdown: EvidenceWeightBreakdown;
  isCopiedReporting: boolean;
  copySimilarity?: number;
  isIndependentConfirmation: boolean;
  originChainId?: string;
  weakSourcing: boolean;
  citesAnonymousSource: boolean;
}

export interface SourceOriginChain {
  chainId: string;
  rootSourceId: string;
  rootSourceName: string;
  downstreamSourceIds: string[];
  description: string;
}

export interface CopiedReportingPair {
  sourceA: string;
  sourceB: string;
  excerptOverlap: number;
  likelySyndicated: boolean;
}

export interface WeakSourcingFlag {
  evidenceId: string;
  reason: string;
  severity: "info" | "warning" | "critical";
}

export interface AnonymousSourceFlag {
  evidenceId?: string;
  pattern: string;
  description: string;
}

export interface UnsupportedAssessment {
  isUnsupported: boolean;
  reason: string;
  supportingSourceCount: number;
  independentSourceCount: number;
}

export interface ClaimResearchScores {
  evidenceQualityScore: number;
  sourceIndependenceScore: number;
  corroborationScore: number;
  contradictionScore: number;
  finalConfidenceScore: number;
}

export interface ClaimResearchReport {
  claimId: string;
  claimText: string;
  scores: ClaimResearchScores;
  verdict: Verdict;
  primaryEvidence: ResearchEvidence[];
  allEvidence: ResearchEvidence[];
  originChains: SourceOriginChain[];
  copiedReporting: CopiedReportingPair[];
  independentConfirmationCount: number;
  repeatedReportingCount: number;
  weakSourcing: WeakSourcingFlag[];
  anonymousSourceDependency: AnonymousSourceFlag[];
  unsupported: UnsupportedAssessment;
  researchSummary: string;
  computedAt: string;
  sourceChainTrace?: SourceChainTraceReport;
  evidenceQuality?: EvidenceQualityAssessment;
}

// ---------------------------------------------------------------------------
// Source-chain tracing engine
// ---------------------------------------------------------------------------

export type SourceOriginRole =
  | "wire_origin"
  | "first_reporter"
  | "cited_upstream"
  | "syndicated_repeat"
  | "unknown";

export interface OriginalSourceLikelihood {
  sourceId: string;
  sourceName: string;
  likelihood: number;
  role: SourceOriginRole;
  rationale: string;
}

export type DependencyRelationship =
  | "cites"
  | "syndicates"
  | "paraphrases"
  | "repeats_excerpt"
  | "wire_propagation";

export interface ReportingDependencyEdge {
  fromSourceId: string;
  toSourceId: string;
  relationship: DependencyRelationship;
  evidenceIds: string[];
  strength: number;
}

export interface ReportingDependencyNode {
  sourceId: string;
  sourceName: string;
  depth: number;
  isIndependent: boolean;
  isSyndicated: boolean;
  dependsOn: string[];
}

export interface ReportingDependencyMap {
  nodes: ReportingDependencyNode[];
  edges: ReportingDependencyEdge[];
}

export interface CitationChain {
  chainId: string;
  orderedSourceIds: string[];
  orderedSourceNames: string[];
  description: string;
}

export interface WirePropagationPath {
  wireSourceId: string;
  wireSourceName: string;
  downstreamSourceIds: string[];
  propagationDepth: number;
}

export interface CircularReportingFinding {
  sourceIds: string[];
  description: string;
  severity: "warning" | "critical";
}

export interface SourceChainTraceReport {
  claimId: string;
  claimText: string;
  originalSourceLikelihood: OriginalSourceLikelihood[];
  reportingDependencyMap: ReportingDependencyMap;
  independentSourceCount: number;
  syndicatedSourceCount: number;
  citationChains: CitationChain[];
  wirePropagation: WirePropagationPath[];
  circularReporting: CircularReportingFinding[];
  repeatedOriginalSourceGroups: RepeatedOriginalSourceGroup[];
  traceSummary: string;
  computedAt: string;
}

export interface RepeatedOriginalSourceGroup {
  upstreamSourceId: string;
  upstreamSourceName: string;
  repeatingSourceIds: string[];
  reason: string;
}

// ---------------------------------------------------------------------------
// 5. EvidenceItem — a single piece of evidence for a claim
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  /** Unique evidence ID (cited in reasoning, e.g. e1). */
  id: string;

  /** Source ID that provided this evidence. */
  sourceId: string;

  /** Publisher name for display/citations. */
  sourceName?: string;

  /** Text excerpt from the source. */
  excerpt: string;

  /** Stance relative to the claim. */
  stance: EvidenceStance;

  /**
   * True when stance is support (backward-compatible).
   * False when contradict; neutral is false.
   */
  supports: boolean;

  /** URL to the source passage. */
  url: string;

  /** Date the evidence was published. */
  publishedAt?: string;

  /** Direct quote vs paraphrase. */
  isDirectQuote?: boolean;

  /** Human-readable citation tag shown in UI (e.g. "[Reuters, 2024]"). */
  citationLabel?: string;

  /** Classified document type for dynamic evidence weighting. */
  evidenceType?: EvidenceDocumentType;

  /** Dynamically computed evidence weight (0–100). */
  dynamicWeight?: number;

  /** How the dynamic weight was derived. */
  weightBreakdown?: EvidenceWeightBreakdown;
}

// ---------------------------------------------------------------------------
// Evidence weighting system
// ---------------------------------------------------------------------------

/** High-trust primary sources vs lower-trust derivative sources. */
export type EvidenceDocumentType =
  | "court_document"
  | "official_filing"
  | "direct_video_audio"
  | "firsthand_reporting"
  | "verified_dataset"
  | "standard_reporting"
  | "anonymous_sourcing"
  | "opinion_article"
  | "secondary_summary"
  | "syndicated_rewrite"
  | "unsourced_social";

export interface EvidenceWeightAdjustment {
  label: string;
  delta: number;
}

export interface EvidenceWeightBreakdown {
  baseTypeWeight: number;
  sourceReliabilityFactor: number;
  adjustments: EvidenceWeightAdjustment[];
  finalWeight: number;
}

export interface EvidenceQualityAssessment {
  aggregateScore: number;
  supportingWeightTotal: number;
  highestWeightEvidenceId?: string;
  lowestWeightEvidenceId?: string;
  typeDistribution: Partial<Record<EvidenceDocumentType, number>>;
  summary: string;
}

// ---------------------------------------------------------------------------
// 6. VerificationResult — outcome of verifying a single claim
// ---------------------------------------------------------------------------

export interface VerificationResult {
  /** Claim ID. */
  claimId: string;

  /** Claim text. */
  claimText: string;

  /** Final verdict. */
  verdict: Verdict;

  /** Confidence 0–100. */
  confidence: number;

  /** Number of sources that support the claim. */
  supportingSources: number;

  /** Number of sources that contradict the claim. */
  contradictingSources: number;

  /** Number of sources that mention it without taking a stance. */
  neutralSources: number;

  /** Key evidence items (top 3–5). */
  keyEvidence: EvidenceItem[];

  /** Detected issues for this claim. */
  issues: IssueFlag[];

  /** Reasoning summary. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// 7. SourceComparison — how different outlets report on the same claim
// ---------------------------------------------------------------------------

export interface SourceComparison {
  /** Claim ID being compared. */
  claimId: string;

  /** Claim text. */
  claimText: string;

  /** Per-source reporting details. */
  sourceReports: SourceReport[];

  /** Agreement score 1–100 (100 = all sources say the same thing). */
  agreementScore: number;

  /** Flagged contradictions between sources. */
  contradictions: Contradiction[];

  /** Detected differences in framing or emphasis. */
  framingDifferences?: FramingDifference[];
}

/** How a single source reported on a specific claim. */
export interface SourceReport {
  /** Source ID. */
  sourceId: string;

  /** Source name. */
  sourceName: string;

  /** Whether this source supports, disputes, or is neutral on the claim. */
  stance: "support" | "dispute" | "neutral" | "not_mentioned";

  /** Relevant excerpt from the source. */
  excerpt?: string;

  /** URL to the article. */
  url?: string;

  /** Tone detected in the source's reporting (e.g., "neutral", "alarmist"). */
  tone?: string;

  /** Prominence of the claim in the article (headline, lede, buried). */
  prominence?: "headline" | "lede" | "body" | "brief";
}

/** A direct contradiction between two sources. */
export interface Contradiction {
  /** IDs of the contradicting sources. */
  sourceIds: [string, string];

  /** Description of the contradiction. */
  description: string;

  /** Severity: minor, significant, or fundamental. */
  severity: "minor" | "significant" | "fundamental";
}

/** Differences in how sources frame the same underlying fact. */
export interface FramingDifference {
  /** What aspect is framed differently. */
  aspect: string;

  /** Per-source framing notes. */
  bySource: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Story consensus — multi-article event comparison
// ---------------------------------------------------------------------------

export type SourceAgreementStance = "support" | "dispute" | "neutral" | "absent" | "omitted";

export interface ConsensusArticleRef {
  articleId: string;
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
  title: string;
  url: string;
  publishedAt?: string;
}

export interface OverlappingClaimGroup {
  groupId: string;
  canonicalText: string;
  articleIds: string[];
  sourceIds: string[];
  agreementScore: number;
  averageConfidence: number;
  verdicts: Partial<Record<Verdict, number>>;
}

export interface DisputedClaimGroup {
  groupId: string;
  canonicalText: string;
  description: string;
  severity: "minor" | "significant" | "fundamental";
  sourceIds: string[];
  articleIds: string[];
  contradictingSources: string[];
  supportingSources: string[];
}

export interface OmittedContextItem {
  groupId?: string;
  claimText: string;
  description: string;
  presentInArticleIds: string[];
  missingFromArticleIds: string[];
  severity: "info" | "warning" | "critical";
}

export interface EmotionalFramingDifference {
  aspect: string;
  description: string;
  bySource: Record<string, { tone: string; score: number; examples: string[] }>;
}

export interface NarrativeDifference {
  aspect: string;
  description: string;
  emphasisBySource: Record<string, string>;
}

export interface SourceAgreementCell {
  groupId: string;
  sourceId: string;
  articleId: string;
  stance: SourceAgreementStance;
  confidence?: number;
  excerpt?: string;
}

export interface SourceAgreementMap {
  sources: ConsensusArticleRef[];
  claimGroups: { groupId: string; canonicalText: string }[];
  cells: SourceAgreementCell[];
}

export interface StoryConsensusReport {
  clusterId: string;
  title: string;
  summary: string;
  articleCount: number;
  sourceCount: number;
  /** Cross-source agreement 0–100. */
  consensusScore: number;
  /** Share of claims with material disagreement 0–100. */
  disputeScore: number;
  /** Ambiguity / missing context / unclear claims 0–100. */
  uncertaintyScore: number;
  /** Overall story confidence 0–100. */
  storyConfidence: number;
  overlappingClaims: OverlappingClaimGroup[];
  disputedClaims: DisputedClaimGroup[];
  omittedContext: OmittedContextItem[];
  emotionalFramingDifferences: EmotionalFramingDifference[];
  narrativeDifferences: NarrativeDifference[];
  sourceAgreementMap: SourceAgreementMap;
  computedAt: string;

  /** Closing narrative summarizing consensus findings across the cluster. */
  findingsSummary?: string;
}

// ---------------------------------------------------------------------------
// 8. SourceReliability — historical reliability metrics for a source
// ---------------------------------------------------------------------------

export interface SourceReliability {
  /** Source ID. */
  sourceId: string;

  /** Source name. */
  sourceName: string;

  /** Overall reliability score 1–100. */
  overallScore: number;

  /** Number of claims checked for this source. */
  claimsChecked: number;

  /** Breakdown of verdicts for this source's claims. */
  verdictBreakdown: Record<Verdict, number>;

  /** Average confidence when this source is cited as evidence. */
  averageEvidenceConfidence: number;

  /** How often this source's claims are supported by others (0–100). */
  corroborationRate: number;

  /** How often this source is the *first* to report verifiable claims. */
  scoopRate?: number;

  /** Trend: improving, stable, or declining. */
  trend: "improving" | "stable" | "declining";

  /** Last updated timestamp. */
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// 9. AnalysisReport — final per-cluster (or per-manual-submission) report
// ---------------------------------------------------------------------------

export interface AnalysisReport {
  /** Report ID. */
  id: string;

  /** Report title. */
  title: string;

  /** URL analyzed (for manual) or cluster ID (for automatic). */
  urlOrClusterId: string;

  /** Overall confidence 0–100. */
  overallConfidence: number;

  /** Executive summary. */
  summary: string;

  /** All claims analyzed. */
  claims: Claim[];

  /** All sources involved. */
  sources: ArticleSource[];

  /** Source comparisons for disputed claims. */
  sourceComparisons?: SourceComparison[];

  /** Issue summary counts. */
  issueSummary: IssueSummary;

  /** Structured issue flags for explainability UI. */
  issueFlags?: IssueFlag[];

  /** Article-level multi-topic classification. */
  topicClassification?: TopicClassification;

  /** Generated timestamp. */
  generatedAt: string;

  /** How long the analysis took in milliseconds. */
  processingTimeMs?: number;

  /** Multi-model verification summary (OpenAI primary, Claude review, Gemini corroboration). */
  multiModelVerification?: MultiModelVerificationReport;

  /** Article-level claim consensus batch. */
  claimConsensus?: ClaimConsensusBatchReport;
}

/** Aggregated issue counts. */
export interface IssueSummary {
  contradictions: number;
  missingContext: number;
  emotionalLanguage: number;
  unsupportedClaims: number;
  totalClaims: number;
}

/** A flagged issue on a specific claim. */
export interface IssueFlag {
  /** Type of issue. */
  type: IssueType;

  /** Human-readable description. */
  description: string;

  /** Severity: info, warning, or critical. */
  severity: "info" | "warning" | "critical";

  /** Related claim ID. */
  claimId: string;

  /** Affected source IDs, if applicable. */
  sourceIds?: string[];
}

// ---------------------------------------------------------------------------
// 10. ApiProvider — configuration for an upstream news API
// ---------------------------------------------------------------------------

export interface ApiProvider {
  /** Provider ID (e.g., "newsapi", "gnews"). */
  id: ApiProviderId;

  /** Human-readable name. */
  name: string;

  /** Base URL for the API. */
  baseUrl: string;

  /** Is the provider currently enabled? */
  enabled: boolean;

  /** Rate limit (requests per minute). */
  rateLimitPerMin: number;

  /** Categories this provider covers well. */
  supportedCategories: Category[];

  /** Countries this provider covers. */
  supportedCountries?: string[];

  /** Does the provider return full article text? */
  returnsFullText: boolean;

  /** Authentication type. */
  authType: "api_key" | "oauth" | "none";

  /** Whether the API key is configured (not the key itself). */
  apiKeyConfigured: boolean;

  /** Typical latency in ms. */
  typicalLatencyMs: number;

  /** Reliability score 1–100 based on uptime/data quality. */
  reliabilityScore: number;
}

// ---------------------------------------------------------------------------
// 11. RssFeed — configuration for an RSS feed source
// ---------------------------------------------------------------------------

export interface RssFeed {
  /** Unique feed ID. */
  id: string;

  /** Feed name. */
  name: string;

  /** RSS / Atom URL. */
  feedUrl: string;

  /** Source / publisher this feed belongs to. */
  sourceId: string;

  /** Category override (if feed is category-specific). */
  category?: Category;

  /** Is the feed currently active? */
  active: boolean;

  /** Last successful fetch timestamp. */
  lastFetchedAt?: string;

  /** Average items per fetch. */
  avgItemsPerFetch: number;

  /** Fetch interval in minutes. */
  fetchIntervalMinutes: number;

  /** Failure streak (for alerting). */
  failureStreak: number;
}

// ---------------------------------------------------------------------------
// 12. ManualSubmission — user-pasted article for analysis
// ---------------------------------------------------------------------------

export interface ManualSubmission {
  /** Submission ID. */
  id: string;

  /** User-provided URL (optional if text is pasted). */
  url?: string;

  /** Pasted article text. */
  text?: string;

  /** User-submitted title (auto-extracted if omitted). */
  title?: string;

  /** Detected or user-selected language. */
  language?: string;

  /** User notes or focus area. */
  userNotes?: string;

  /** When the user submitted. */
  submittedAt: string;

  /** Current status. */
  status: "pending" | "processing" | "completed" | "failed";

  /** Result report, once ready. */
  report?: AnalysisReport;

  /** Error message, if failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Final intelligence orchestration (epistemic scores — not objective truth)
// ---------------------------------------------------------------------------

export interface FinalIntelligenceSummary {
  finalArticleReliability: number;
  finalSourceReliability: number | null;
  finalAuthorReliability: number | null;
  finalStoryConfidence: number | null;
  finalUncertaintyLevel: number;
  disclaimer: string;
  intelligenceSummary: string;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// 13. UserAnalysisRequest — a queued or completed analysis job
// ---------------------------------------------------------------------------

export interface UserAnalysisRequest {
  /** Request ID. */
  id: string;

  /** User ID (if authenticated). */
  userId?: string;

  /** Type of analysis requested. */
  type: "manual_url" | "manual_text" | "automatic_cluster" | "pipeline_run";

  /** For manual: the submission data. */
  submission?: ManualSubmission;

  /** For automatic: the cluster being analyzed. */
  clusterId?: string;

  /** Current status. */
  status: "queued" | "processing" | "completed" | "failed";

  /** Progress 0–100 (for long-running jobs). */
  progress: number;

  /** Created timestamp. */
  createdAt: string;

  /** Started timestamp. */
  startedAt?: string;

  /** Completed timestamp. */
  completedAt?: string;

  /** Result report. */
  report?: AnalysisReport;

  /** Consolidated epistemic scores from the final intelligence layer. */
  finalIntelligence?: FinalIntelligenceSummary;

  /** Error, if any. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Pipeline / System Types
// ---------------------------------------------------------------------------

/** A single stage in the automatic news pipeline. */
export interface PipelineStage {
  /** Stage identifier. */
  id: string;

  /** Human-readable title. */
  title: string;

  /** What this stage does. */
  description: string;

  /** Expected input description. */
  input: string;

  /** Expected output description. */
  output: string;

  /** Typical duration in ms. */
  durationMs: number;
}

/** Aggregate metrics across a pipeline run. */
export interface PipelineMetrics {
  fetched: number;
  normalized: number;
  unique: number;
  clusters: number;
  top: number;
  claims: number;
  evidence: number;
  comparisons: number;
  issues: {
    contradictions: number;
    missingContext: number;
    emotional: number;
    unsupported: number;
  };
  reports: number;
}

/** Dashboard statistics snapshot. */
export interface DashboardStats {
  totalClusters: number;
  totalArticles: number;
  totalClaims: number;
  avgConfidence: number;
  disputedClaims: number;
  missingContext: number;
  sourcesTracked: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Reliability scoring (evidence-weighted — not objective truth)
// ---------------------------------------------------------------------------

/** How reliability scores should be interpreted in product copy. */
export const RELIABILITY_SCORING_DISCLAIMER =
  "Scores describe evidence-weighted reliability, corroboration confidence, reporting consistency, source transparency, and contradiction frequency — not objective truth.";

export const RELIABILITY_SCORING_DIMENSIONS = [
  "evidence-weighted reliability",
  "corroboration confidence",
  "reporting consistency",
  "source transparency",
  "contradiction frequency",
] as const;

export type ReliabilityCategoryId =
  | "evidence_support"
  | "cross_source_corroboration"
  | "context_completeness"
  | "contradiction_detection"
  | "sensationalism"
  | "source_transparency";

export type ReliabilityTrendDirection = "improving" | "stable" | "declining";

export interface ReliabilityCategoryScore {
  id: ReliabilityCategoryId;
  label: string;
  score: number;
  weight: number;
  /** Plain-language description of what this category measures. */
  description: string;
}

export interface ReliabilityTrendPoint {
  recordedAt: string;
  score: number;
}

export interface ReliabilityTrend {
  direction: ReliabilityTrendDirection;
  rollingAverage: number;
  sampleSize: number;
  windowSize: number;
  points: ReliabilityTrendPoint[];
}

export interface ScoreAppliedPenalties {
  contradictionPenalty: number;
  sensationalPenalty: number;
  missingContextPenalty: number;
  insufficientEvidencePenalty: number;
}

export interface ArticleReliabilityScore {
  articleId: string;
  reportId?: string;
  url: string;
  title: string;
  topic: Category;
  overallScore: number;
  categories: ReliabilityCategoryScore[];
  organizationId?: string;
  authorId?: string;
  computedAt: string;
  version: number;
  avgClaimConfidence?: number;
  contradictionCount?: number;
  appliedPenalties?: ScoreAppliedPenalties;
  /** Multi-topic labels from topic classifier. */
  topicClassification?: TopicClassification;
}

export interface TopicReliabilityScore {
  topic: Category;
  overallScore: number;
  rollingAverage: number;
  trend: ReliabilityTrend;
  articlesScored: number;
  computedAt: string;
}

export interface OrganizationReliabilityScore {
  organizationId: string;
  name: string;
  domain: string;
  overallScore: number;
  rollingAverage: number;
  trend: ReliabilityTrend;
  reportingConsistency: number;
  corroborationConfidence: number;
  sourceTransparency: number;
  contradictionFrequency: number;
  topicScores: TopicReliabilityScore[];
  /** Per ContentTopic reliability (AI taxonomy). */
  contentTopicReliability?: TopicSourceReliability[];
  articlesScored: number;
  computedAt: string;
}

export interface AuthorReliabilityScore {
  authorId: string;
  displayName: string;
  overallScore: number;
  rollingAverage: number;
  trend: ReliabilityTrend;
  reportingConsistency: number;
  corroborationConfidence: number;
  articlesScored: number;
  topicScores: TopicReliabilityScore[];
  computedAt: string;
}

export interface ReliabilityScoreHistoryEntry {
  entityType: "article" | "organization" | "author" | "topic";
  entityId: string;
  score: number;
  recordedAt: string;
  reportId?: string;
  topic?: Category;
}

export interface ReliabilityScoreBundle {
  disclaimer: string;
  scoringDimensions: readonly string[];
  article: ArticleReliabilityScore;
  organization: OrganizationReliabilityScore | null;
  author: AuthorReliabilityScore | null;
  topics: TopicReliabilityScore[];
  trends: {
    article: ReliabilityTrend;
    organization: ReliabilityTrend | null;
    author: ReliabilityTrend | null;
  };
  history: ReliabilityScoreHistoryEntry[];
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Historical trend analytics (graph APIs)
// ---------------------------------------------------------------------------

export type HistoricalEntityType = "article" | "source" | "author" | "topic";

export type HistoricalMetricType =
  | "overall_score"
  | "rolling_average"
  | "confidence"
  | "contradiction_count"
  | "contradiction_detection"
  | "sensationalism"
  | "evidence_support"
  | "corroboration_rate"
  | "reporting_consistency"
  | "source_transparency";

export type TrendRollingWindowKey = "days7" | "days30" | "days90" | "year365";

export interface RollingWindowAverages {
  days7: number | null;
  days30: number | null;
  days90: number | null;
  year365: number | null;
}

export interface TrendGraphPoint {
  recordedAt: string;
  value: number;
}

export interface TrendGraphSeries {
  metricType: HistoricalMetricType;
  metricKey?: string;
  label: string;
  points: TrendGraphPoint[];
  rollingAverages: RollingWindowAverages;
}

export interface TrendAnalyticsSummary {
  currentValue: number | null;
  direction: ReliabilityTrendDirection;
  sampleSize: number;
  delta30d: number | null;
  rollingAverages: RollingWindowAverages;
}

export interface TrendGraphResponse {
  disclaimer: string;
  entityType: HistoricalEntityType;
  entityId: string;
  entityLabel?: string;
  topic?: Category;
  timeRange: { from: string; to: string };
  granularity: "point" | "day";
  series: TrendGraphSeries[];
  summary: TrendAnalyticsSummary;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Score explainability (transparency)
// ---------------------------------------------------------------------------

export type ExplainableEntityType = "article" | "source" | "author" | "story";

export interface ExplainabilityEvidenceItem {
  id: string;
  claimId: string;
  claimText: string;
  sourceId: string;
  sourceName: string;
  stance: EvidenceStance;
  excerpt: string;
  url?: string;
  citationLabel?: string;
  verdict?: Verdict;
}

export interface CorroboratingSourceEntry {
  sourceId: string;
  sourceName: string;
  domain?: string;
  agreementScore?: number;
  supportingClaims: number;
  excerpts: string[];
}

export interface ContradictionHistoryEntry {
  claimId: string;
  claimText: string;
  description: string;
  severity: "minor" | "significant" | "fundamental";
  sourceIds: string[];
  sourceNames: string[];
  recordedAt: string;
}

export interface OmittedContextEntry {
  claimId: string;
  claimText: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export interface ScoreCalculationStep {
  categoryId: ReliabilityCategoryId;
  label: string;
  score: number;
  weight: number;
  weightPercent: number;
  contribution: number;
  description: string;
  formulaSummary: string;
}

export interface HistoricalScoreChange {
  version: number;
  recordedAt: string;
  overallScore: number;
  delta: number | null;
  summary: string;
}

export interface ScoreExplainability {
  entityType: ExplainableEntityType;
  entityId: string;
  entityLabel: string;
  overallScore: number;
  disclaimer: string;
  whyScoreExists: string;
  howCalculated: string;
  weightedFormula: string;
  calculationSteps: ScoreCalculationStep[];
  supportingEvidence: ExplainabilityEvidenceItem[];
  disputedEvidence: ExplainabilityEvidenceItem[];
  corroboratingSources: CorroboratingSourceEntry[];
  contradictionHistory: ContradictionHistoryEntry[];
  omittedContext: OmittedContextEntry[];
  aiReasoningSummary: string;
  confidenceExplanation: string;
  appliedPenalties?: ScoreAppliedPenalties;
  historicalChanges: HistoricalScoreChange[];
  reportId?: string;
  articleId?: string;
}

export interface AnalysisExplainabilityBundle {
  article: ScoreExplainability;
  source: ScoreExplainability | null;
  author: ScoreExplainability | null;
}

/** Full transparency bundle: article, source, author, and story (cluster) scores. */
export interface TransparencyExplainabilityBundle extends AnalysisExplainabilityBundle {
  story: ScoreExplainability | null;
}

export interface HistoricalScoreSnapshotRecord {
  id: string;
  entityType: HistoricalEntityType;
  entityId: string;
  metricType: HistoricalMetricType;
  metricKey?: string;
  scoreValue: number;
  sampleSize?: number;
  topic?: Category;
  reportId?: string;
  articleId?: string;
  metadata?: Record<string, unknown>;
  recordedAt: string;
}
