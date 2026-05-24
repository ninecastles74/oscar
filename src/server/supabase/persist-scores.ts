import type { Category } from "@/types/news-platform";
import type { RecalculateScoresResult } from "../reliability/types/scoring.types";
import type { PersistScoresContext } from "../reliability/engine";
import { getSupabaseAdmin } from "./client";
import { isSupabaseConfigured } from "./config";
import { seedApprovedSources } from "./seed-sources";
import { toDbCategory, toDbTrendDirection } from "./mappers";

async function getArticleDbId(externalId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("articles")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();
  return data?.id ?? null;
}

async function getSourceDbIdByDomain(domain: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("sources").select("id").eq("domain", domain).maybeSingle();
  return data?.id ?? null;
}

/**
 * Persist reliability scores and historical snapshots to Supabase.
 */
export async function persistScoresToSupabase(
  result: RecalculateScoresResult,
  ctx: PersistScoresContext,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await seedApprovedSources();

  const articleDbId = await getArticleDbId(ctx.article.submissionId);
  if (!articleDbId) {
    console.warn("[supabase] article not found for scores; run analysis persist first");
    return;
  }

  const { article, organization, author, topic: topicScore, trends } = result;

  await supabase
    .from("article_scores")
    .update({ is_current: false, superseded_at: new Date().toISOString() })
    .eq("article_id", articleDbId)
    .eq("is_current", true);

  const { data: scoreRow, error: scoreErr } = await supabase
    .from("article_scores")
    .insert({
      article_id: articleDbId,
      version: article.version ?? 1,
      is_current: true,
      report_id: ctx.reportId,
      overall_score: article.overallScore,
      rolling_average: trends.article.rollingAverage ?? article.overallScore,
      trend_direction: toDbTrendDirection(trends.article.direction),
      sample_size: trends.article.sampleSize ?? 1,
      evidence_support: article.categories.find((c) => c.id === "evidence_support")?.score ?? 0,
      cross_source_corroboration:
        article.categories.find((c) => c.id === "cross_source_corroboration")?.score ?? 0,
      context_completeness:
        article.categories.find((c) => c.id === "context_completeness")?.score ?? 0,
      contradiction_detection:
        article.categories.find((c) => c.id === "contradiction_detection")?.score ?? 0,
      sensationalism: article.categories.find((c) => c.id === "sensationalism")?.score ?? 0,
      source_transparency:
        article.categories.find((c) => c.id === "source_transparency")?.score ?? 0,
      categories_json: article.categories,
      contradiction_count: article.contradictionCount,
      missing_context_count: ctx.results.issueSummary.missingContext,
      avg_claim_confidence: article.avgClaimConfidence,
    })
    .select("id")
    .single();

  if (scoreErr) {
    console.error("[supabase] article_scores insert failed:", scoreErr.message);
    return;
  }

  const articleScoreId = scoreRow?.id as string | undefined;
  const snapshots: Record<string, unknown>[] = [];

  const pushSnapshot = (row: {
    entity_type: string;
    entity_id: string;
    metric_type: string;
    score_value: number;
    metric_key?: string;
    sample_size?: number;
    metadata?: object;
  }) => {
    snapshots.push({
      ...row,
      topic: toDbCategory(ctx.topic),
      article_score_id: articleScoreId ?? null,
      report_id: ctx.reportId,
      recorded_at: new Date().toISOString(),
    });
  };

  pushSnapshot({
    entity_type: "article",
    entity_id: article.articleId,
    metric_type: "overall_score",
    score_value: article.overallScore,
    sample_size: 1,
  });
  pushSnapshot({
    entity_type: "article",
    entity_id: article.articleId,
    metric_type: "confidence",
    score_value: article.avgClaimConfidence,
    metadata: { appliedPenalties: article.appliedPenalties },
  });
  pushSnapshot({
    entity_type: "article",
    entity_id: article.articleId,
    metric_type: "contradiction_count",
    score_value: article.contradictionCount,
  });

  for (const cat of article.categories) {
    const metricMap: Record<string, string> = {
      evidence_support: "evidence_support",
      cross_source_corroboration: "corroboration_rate",
      contradiction_detection: "contradiction_detection",
      sensationalism: "sensationalism",
      source_transparency: "source_transparency",
    };
    const mt = metricMap[cat.id];
    if (mt) {
      pushSnapshot({
        entity_type: "article",
        entity_id: article.articleId,
        metric_type: mt,
        score_value: cat.score,
        metric_key: cat.id,
        metadata: { weight: cat.weight },
      });
    }
  }

  if (organization) {
    const sourceDbId = await getSourceDbIdByDomain(organization.domain);
    if (sourceDbId) {
      await supabase
        .from("source_scores")
        .update({ is_current: false, superseded_at: new Date().toISOString() })
        .eq("source_id", sourceDbId)
        .eq("topic", toDbCategory(ctx.topic))
        .eq("is_current", true);

      await supabase.from("source_scores").insert({
        source_id: sourceDbId,
        topic: toDbCategory(ctx.topic),
        version: 1,
        is_current: true,
        overall_score: organization.overallScore,
        rolling_average: organization.rollingAverage,
        trend_direction: toDbTrendDirection(organization.trend.direction),
        sample_size: organization.articlesScored,
        reporting_consistency: organization.reportingConsistency,
        corroboration_confidence: organization.corroborationConfidence,
        source_transparency: organization.sourceTransparency,
        contradiction_frequency: organization.contradictionFrequency,
        articles_scored: organization.articlesScored,
        triggered_by_article_id: articleDbId,
      });
    }

    pushSnapshot({
      entity_type: "source",
      entity_id: organization.organizationId,
      metric_type: "overall_score",
      score_value: organization.overallScore,
      sample_size: organization.articlesScored,
    });
  }

  if (author) {
    pushSnapshot({
      entity_type: "author",
      entity_id: author.authorId,
      metric_type: "overall_score",
      score_value: author.overallScore,
      sample_size: author.articlesScored,
    });
  }

  pushSnapshot({
    entity_type: "topic",
    entity_id: ctx.topic,
    metric_type: "overall_score",
    score_value: topicScore.overallScore,
    sample_size: topicScore.articlesScored,
  });

  if (snapshots.length > 0) {
    const { error: snapErr } = await supabase.from("historical_score_snapshots").insert(snapshots);
    if (snapErr) console.error("[supabase] snapshots insert failed:", snapErr.message);
  }
}
