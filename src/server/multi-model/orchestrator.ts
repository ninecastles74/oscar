import { getLastGeminiError } from "../ai/gemini-client";
import { getLastOpenAiError } from "../ai/openai-client";
import { AnalysisError } from "../analysis/errors";
import {
  hasAnyAiApiKey,
  isOpenAiConfigured,
  isServerEnvTruthy,
  listDetectedAiEnvKeys,
} from "../env/server-env";
import type {
  AnalysisReport,
  EvidenceItem,
  MultiModelVerificationReport,
  Verdict,
} from "@/types/news-platform";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { CLAIM_EVIDENCE_FAILED_WARNING } from "../analysis/verification/evidence-messages";
import {
  availableProviders,
  isGeminiLiveEnabled,
  isMultiModelEnabled,
  REVIEW_CONFIDENCE_THRESHOLD,
  REVIEW_VERDICTS,
} from "./config";
import { getServerEnv } from "../env/server-env";
import { isGeminiGoogleSearchEnabled, isGoogleAiConfigured } from "../ai/google-api-key";
import { buildMultiModelConsensus, toClaimVerification } from "./consensus";
import { providersInvolved } from "./disagreement";
import { getLastAnthropicError, verifyClaimWithAnthropic } from "./providers/anthropic";
import { verifyClaimWithGemini } from "./providers/gemini";
import { verifyClaimWithOpenAI } from "./providers/openai";
import type { ModelClaimVerdict } from "@/types/news-platform";
import { clampScore } from "../reliability/utils/math";

function liveAiError(message: string): never {
  throw new AnalysisError("LIVE_AI_REQUIRED", message, 503);
}

function needsClaudeReview(primary: ModelClaimVerdict, pipeline: { verdict: string; confidence: number }): boolean {
  return (
    REVIEW_VERDICTS.includes(primary.verdict) ||
    primary.confidence < REVIEW_CONFIDENCE_THRESHOLD ||
    REVIEW_VERDICTS.includes(pipeline.verdict as ModelClaimVerdict["verdict"])
  );
}

function pipelineFallbackVerification(
  claim: { id: string; text: string; verdict: string; confidence: number },
  reason: string,
): import("@/types/news-platform").MultiModelClaimVerification {
  const verdict = claim.verdict as Verdict;
  const confidence = claim.confidence;
  const consensus = buildMultiModelConsensus(
    claim.id,
    claim.text,
    [
      {
        provider: "openai",
        model: "pipeline-fallback",
        role: "primary",
        verdict,
        confidence,
        reasoning: reason,
        skipped: true,
        skipReason: "multi_model_unavailable",
      },
    ],
    { verdict, confidence },
  );
  return toClaimVerification(claim.id, claim.text, consensus, ["multi_model_degraded"]);
}

async function verifyOneClaim(
  claim: { id: string; text: string; verdict: string; confidence: number },
  evidence: EvidenceItem[],
  contradiction?: import("@/types/news-platform").ContradictionAnalysisReport,
): Promise<{ verification: import("@/types/news-platform").MultiModelClaimVerification; stages: string[] }> {
  const stages: string[] = [];
  const evidencePayload = evidence.map((e) => ({
    stance: e.stance,
    sourceName: e.sourceName,
    excerpt: e.excerpt,
  }));

  const pipelineFallback = {
    verdict: claim.verdict as import("@/types/news-platform").Verdict,
    confidence: claim.confidence,
  };

  let primary: ModelClaimVerdict | null = null;
  if (isOpenAiConfigured()) {
    stages.push("openai_primary");
    primary = await verifyClaimWithOpenAI({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidencePayload,
      role: "primary",
    });
    if (!primary && isGeminiLiveEnabled()) {
      stages.push("gemini_primary_fallback");
      primary = await verifyClaimWithGemini({
        claimId: claim.id,
        claimText: claim.text,
        evidence: evidencePayload,
        role: "primary",
      });
    }
  } else if (isGeminiLiveEnabled()) {
    stages.push("gemini_primary");
    primary = await verifyClaimWithGemini({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidencePayload,
      role: "primary",
    });
  }

  if (!primary) {
    stages.push("primary_degraded");
    return {
      verification: pipelineFallbackVerification(
        claim,
        "Live model verification was temporarily unavailable; using pipeline evidence scores.",
      ),
      stages,
    };
  }

  let review: ModelClaimVerdict | null = null;
  const runReview = needsClaudeReview(primary, pipelineFallback);
  if (runReview) {
    if (isServerEnvTruthy("ANTHROPIC_API_KEY")) {
      stages.push("claude_review");
      review = await verifyClaimWithAnthropic({
        claimId: claim.id,
        claimText: claim.text,
        evidence: evidencePayload,
        role: "review",
        priorVerdict: primary,
      });
      if (!review) {
        stages.push("review_degraded");
        review = {
          provider: "anthropic",
          model: "unavailable",
          role: "review",
          verdict: primary.verdict,
          confidence: primary.confidence,
          reasoning: "Review model was temporarily unavailable; using primary verdict.",
          skipped: true,
          skipReason: "review_unavailable",
        };
      }
    } else if (isGeminiLiveEnabled()) {
      stages.push("gemini_review");
      review = await verifyClaimWithGemini({
        claimId: claim.id,
        claimText: claim.text,
        evidence: evidencePayload,
        role: "review",
        priorVerdict: primary,
      });
      if (!review) {
        stages.push("review_degraded");
        review = {
          provider: "google",
          model: "unavailable",
          role: "review",
          verdict: primary.verdict,
          confidence: primary.confidence,
          reasoning: "Review model was temporarily unavailable; using primary verdict.",
          skipped: true,
          skipReason: "review_unavailable",
        };
      }
    } else {
      review = {
        provider: "anthropic",
        model: "skipped",
        role: "review",
        verdict: primary.verdict,
        confidence: primary.confidence,
        reasoning: "Review skipped — no secondary model configured.",
        skipped: true,
        skipReason: "not_configured",
      };
    }
  } else {
    review = {
      provider: "anthropic",
      model: "skipped",
      role: "review",
      verdict: primary.verdict,
      confidence: primary.confidence,
      reasoning: "Skipped — primary confidence sufficient and not disputed.",
      skipped: true,
      skipReason: "not_uncertain",
    };
  }

  const hasLiveWebEvidence = evidence.some((e) => e.id?.includes("-live-e"));
  let corroboration: ModelClaimVerdict | null = null;

  if (!isGeminiLiveEnabled()) {
    stages.push("corroboration_skipped");
    corroboration = {
      provider: "google",
      model: "skipped",
      role: "corroboration",
      verdict: (review.skipped ? primary : review).verdict,
      confidence: (review.skipped ? primary : review).confidence,
      reasoning: "Gemini corroboration skipped — key not configured.",
      skipped: true,
      skipReason: "not_configured",
    };
  } else if (hasLiveWebEvidence) {
    const prior = review.skipped ? primary : review;
    stages.push("gemini_corroboration_live_evidence");
    corroboration = {
      provider: "google",
      model: "live-evidence",
      role: "corroboration",
      verdict: prior.verdict,
      confidence: prior.confidence,
      reasoning:
        "Corroboration from live web evidence gathered during verification (skips redundant Gemini JSON pass).",
      geminiMeta: {
        liveApiCalled: false,
        searchPerformed: true,
        searchQueryCount: 0,
        webSearchQueries: [],
        sourcesUsed: evidence
          .filter((e) => e.id?.includes("-live-e"))
          .slice(0, 4)
          .map((e) => ({ title: e.sourceName, uri: e.url })),
      },
    };
  } else {
    stages.push("gemini_corroboration");
    corroboration = await verifyClaimWithGemini({
      claimId: claim.id,
      claimText: claim.text,
      evidence: evidencePayload,
      role: "corroboration",
      priorVerdict: review.skipped ? primary : review,
      skipGoogleSearch: false,
    });
  }

  if (!corroboration) {
    const err = getLastGeminiError();
    console.warn(
      `[multi-model] corroboration unavailable for claim ${claim.id}:`,
      err ?? "(no detail)",
    );
    stages.push("corroboration_degraded");
    const prior = review.skipped ? primary : review;
    corroboration = {
      provider: "google",
      model: "unavailable",
      role: "corroboration",
      verdict:
        evidence.length === 0
          ? ("insufficient_evidence" as const)
          : prior.verdict,
      confidence: Math.min(prior.confidence, evidence.length === 0 ? 30 : prior.confidence),
      reasoning:
        evidence.length === 0
          ? "Live evidence retrieval failed for this claim; corroboration skipped."
          : "Gemini corroboration was temporarily unavailable; using prior model consensus.",
      skipped: true,
      skipReason: "gemini_unavailable",
    };
  }

  const modelVerdicts = [primary, review, corroboration];
  stages.push("consensus");
  const consensus = buildMultiModelConsensus(claim.id, claim.text, modelVerdicts, pipelineFallback);

  return {
    verification: toClaimVerification(claim.id, claim.text, consensus, stages),
    stages,
  };
}

export async function arbitrateSingleClaim(
  claim: { id: string; text: string; verdict: string; confidence: number },
  evidence: EvidenceItem[],
  contradiction?: import("@/types/news-platform").ContradictionAnalysisReport,
) {
  return verifyOneClaim(claim, evidence, contradiction);
}

const MANUAL_MAX_CLAIMS = Number(getServerEnv("MANUAL_MULTIMODEL_MAX_CLAIMS")) || 5;
const SCHEDULED_MAX_CLAIMS = Number(getServerEnv("SCHEDULED_MULTIMODEL_MAX_CLAIMS")) || 5;
const DEFAULT_MANUAL_CONCURRENCY = 2;
const DEFAULT_SCHEDULED_CONCURRENCY = 1;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function countLiveEvidenceClaims(results: VerificationPipelineResults): number {
  return Object.values(results.evidenceByClaimId).filter((items) =>
    items?.some((e) => e?.id?.includes("-live-e")),
  ).length;
}

export async function runMultiModelVerification(
  results: VerificationPipelineResults,
  options?: { trigger?: "user" | "scheduled" },
): Promise<MultiModelVerificationReport> {
  let claims = results.scoredClaims;
  if (options?.trigger === "user" && claims.length > MANUAL_MAX_CLAIMS) {
    claims = claims.slice(0, MANUAL_MAX_CLAIMS);
  }
  if (options?.trigger === "scheduled" && claims.length > SCHEDULED_MAX_CLAIMS) {
    claims = claims.slice(0, SCHEDULED_MAX_CLAIMS);
  }

  const concurrencyRaw = Number.parseInt(
    getServerEnv("MANUAL_MULTIMODEL_CONCURRENCY") ?? "",
    10,
  );
  const concurrency =
    options?.trigger === "scheduled"
      ? Number.isFinite(concurrencyRaw) && concurrencyRaw > 0
        ? concurrencyRaw
        : DEFAULT_SCHEDULED_CONCURRENCY
      : Number.isFinite(concurrencyRaw) && concurrencyRaw > 0
        ? concurrencyRaw
        : DEFAULT_MANUAL_CONCURRENCY;

  const failedLiveIds = new Set(results.liveEvidenceFailedClaimIds ?? []);

  const verifications = await mapWithConcurrency(claims, concurrency, async (claim) => {
    const evidence = results.evidenceByClaimId[claim.id] ?? claim.evidence ?? [];
    const contradiction = results.contradictionAnalyses?.[claim.id];
    try {
      const { verification } = await verifyOneClaim(claim, evidence, contradiction);
      return verification;
    } catch (err) {
      console.warn(
        `[multi-model] claim verification degraded (${claim.id.slice(0, 12)}…):`,
        err instanceof Error ? err.message : err,
      );
      return pipelineFallbackVerification(
        claim,
        failedLiveIds.has(claim.id)
          ? CLAIM_EVIDENCE_FAILED_WARNING
          : "Multi-model verification was temporarily unavailable; using pipeline scores.",
      );
    }
  });

  if (verifications.length === 0) {
    liveAiError("Multi-model verification produced no claim results.");
  }

  console.log(
    "[multi-model] verification summary:",
    JSON.stringify({
      total: verifications.length,
      degraded: verifications.filter((v) => v.stagesRun?.includes("multi_model_degraded")).length,
      liveEvidenceFailed: failedLiveIds.size,
    }),
  );

  const disagreementCount = verifications.filter(
    (v) => v.consensus.disagreementDetected,
  ).length;
  const overallConfidence =
    verifications.length === 0
      ? 0
      : clampScore(
          verifications.reduce((s, v) => s + v.consensus.finalConfidence, 0) /
            verifications.length,
        );

  const modelsUsed = [
    ...new Set(verifications.flatMap((v) => providersInvolved(v.consensus.modelVerdicts))),
  ];
  if (modelsUsed.length === 0) {
    for (const p of availableProviders()) modelsUsed.push(p);
  }

  let geminiLiveCalls = 0;
  let claimsWithGoogleSearch = 0;
  let totalSearchQueries = 0;
  let totalGeminiTokens = 0;
  const geminiAttempts = verifications.filter((v) =>
    (v.stagesRun ?? []).includes("gemini_corroboration"),
  ).length;
  for (const v of verifications) {
    const gem = v.consensus.modelVerdicts.find((m) => m.provider === "google");
    if (gem?.geminiMeta?.liveApiCalled) geminiLiveCalls += 1;
    if (gem?.geminiMeta?.searchPerformed) {
      claimsWithGoogleSearch += 1;
      totalSearchQueries += gem.geminiMeta.searchQueryCount;
    }
    if (gem?.geminiMeta?.totalTokens) totalGeminiTokens += gem.geminiMeta.totalTokens;
  }

  const liveEvidenceClaims = countLiveEvidenceClaims(results);

  const geminiUsage = {
    configured: isGoogleAiConfigured(),
    googleSearchEnabled: isGeminiGoogleSearchEnabled(),
    liveApiCalls: geminiLiveCalls,
    claimsWithGoogleSearch,
    totalSearchQueries,
    totalTokens: totalGeminiTokens > 0 ? totalGeminiTokens : undefined,
    runtimeEnvKeys: listDetectedAiEnvKeys(),
    liveApiAttempts: geminiAttempts,
    lastApiError: geminiLiveCalls === 0 && geminiAttempts > 0 ? getLastGeminiError() : undefined,
    liveEvidenceClaims,
  };

  const geminiNote = isGoogleAiConfigured()
    ? geminiLiveCalls > 0
      ? ` Gemini: ${geminiLiveCalls} live call(s), ${totalSearchQueries} Google Search quer${totalSearchQueries === 1 ? "y" : "ies"}.`
      : ` Gemini key set but no live corroboration responses (${geminiAttempts} attempt(s)${getLastGeminiError() ? ` — ${getLastGeminiError()}` : ""}).`
    : " Gemini: not configured (set GOOGLE_AI_API_KEY or GEMINI_API_KEY).";

  return {
    articleId: results.article.submissionId,
    claims: verifications,
    overallConfidence,
    disagreementCount,
    modelsUsed,
    geminiUsage,
    summary: `Live multi-model verification: ${verifications.length} claim(s), ${disagreementCount} with model disagreement. Overall confidence ${overallConfidence}/100.${geminiNote}`,
    computedAt: new Date().toISOString(),
  };
}

export function applyMultiModelToReport(
  report: AnalysisReport,
  multiModel: MultiModelVerificationReport,
  options?: { liveEvidenceFailedClaimIds?: Iterable<string> },
): AnalysisReport {
  const failedLive = new Set(options?.liveEvidenceFailedClaimIds ?? []);
  const byClaim = new Map(multiModel.claims.map((c) => [c.claimId, c]));
  const claims = report.claims.map((c) => {
    const mm = byClaim.get(c.id);
    if (!mm) return c;

    if (failedLive.has(c.id)) {
      return {
        ...c,
        verdict: "insufficient_evidence" as const,
        confidence: Math.min(c.confidence, 25),
        evidence: [],
        context: CLAIM_EVIDENCE_FAILED_WARNING,
        multiModelVerification: mm,
        reasoning: [c.reasoning, "Live evidence unavailable — Insufficient Evidence."]
          .filter(Boolean)
          .join(" "),
      };
    }

    return {
      ...c,
      verdict: mm.consensus.finalVerdict,
      confidence: mm.consensus.finalConfidence,
      multiModelVerification: mm,
      reasoning: [
        c.reasoning,
        `Multi-model (${mm.consensus.arbitrationMethod}): ${mm.consensus.consensusSummary}`,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });

  const overallConfidence =
    claims.length === 0
      ? report.overallConfidence
      : clampScore(claims.reduce((s, c) => s + c.confidence, 0) / claims.length);

  return {
    ...report,
    claims,
    overallConfidence,
    multiModelVerification: multiModel,
    summary: `${report.summary} ${multiModel.summary}`,
  };
}

export async function enrichVerificationWithMultiModel(
  bundle: import("../analysis/verification/types").VerificationReportBundle,
  trigger: "user" | "scheduled" = "user",
): Promise<import("../analysis/verification/types").VerificationReportBundle> {
  if (!isMultiModelEnabled(trigger)) {
    throw new AnalysisError(
      "LIVE_AI_REQUIRED",
      "Multi-model verification is disabled. Live analysis cannot run.",
      503,
    );
  }

  const multiModel = await runMultiModelVerification(bundle.results, { trigger });
  const report = applyMultiModelToReport(bundle.report, multiModel, {
    liveEvidenceFailedClaimIds: bundle.results.liveEvidenceFailedClaimIds,
  });
  return {
    ...bundle,
    report,
    results: {
      ...bundle.results,
      scoredClaims: report.claims as typeof bundle.results.scoredClaims,
    },
    stages: [...bundle.stages, "multiModelVerification"],
  };
}
