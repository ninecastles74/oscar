import type { AnalysisReport } from "@/types/news-platform";
import type { PipelineArticleContext } from "../analysis/types";
import type { VerificationPipelineResults } from "../analysis/verification/types";
import { getSupabaseAdmin } from "./client";
import { isSupabaseConfigured } from "./config";
import { seedApprovedSources } from "./seed-sources";
import { toDbCategory, toDbClaimKind, toDbContentPolicy, toDbVerdict } from "./mappers";

const sourceIdCache = new Map<string, string>();

async function resolveSourceUuid(slug: string): Promise<string | null> {
  if (sourceIdCache.has(slug)) return sourceIdCache.get(slug)!;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("sources").select("id").eq("slug", slug).maybeSingle();
  if (data?.id) {
    sourceIdCache.set(slug, data.id);
    return data.id;
  }
  return null;
}

/**
 * Persist manual analysis article, run, claims, and evidence to Supabase.
 */
export async function persistAnalysisToSupabase(
  report: AnalysisReport,
  results: VerificationPipelineResults,
  article: PipelineArticleContext,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await seedApprovedSources();

  const externalId = article.submissionId;
  const canonicalUrl = article.url || `manual://${externalId}`;

  const { data: articleRow, error: articleErr } = await supabase
    .from("articles")
    .upsert(
      {
        external_id: externalId,
        url: article.url,
        canonical_url: canonicalUrl,
        title: article.title,
        summary: article.summary,
        topic: toDbCategory(results.articleTopicClassification?.primaryTopic ?? "General"),
        language: article.language ?? "en",
        content_policy: toDbContentPolicy(article.contentRights),
        rights_note: article.rightsNote,
        published_at: article.publishedAt ?? null,
      },
      { onConflict: "canonical_url" },
    )
    .select("id")
    .single();

  if (articleErr || !articleRow) {
    console.error("[supabase] article upsert failed:", articleErr?.message);
    return;
  }

  const articleDbId = articleRow.id as string;

  const { data: runRow, error: runErr } = await supabase
    .from("analysis_runs")
    .insert({
      article_id: articleDbId,
      report_id: report.id,
      status: "completed",
      progress: 100,
      started_at: new Date(results.startedAt).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runErr || !runRow) {
    console.error("[supabase] analysis_run insert failed:", runErr?.message);
    return;
  }

  const runDbId = runRow.id as string;

  for (const claim of report.claims) {
    const classified = results.classifiedClaims.find((c) => c.id === claim.id);
    const { data: claimRow, error: claimErr } = await supabase
      .from("claims")
      .upsert(
        {
          article_id: articleDbId,
          analysis_run_id: runDbId,
          external_id: claim.id,
          text: claim.text,
          kind: toDbClaimKind(classified?.kind ?? "factual"),
          verifiable: classified?.verifiable ?? true,
          verdict: toDbVerdict(claim.verdict),
          confidence: claim.confidence,
          reasoning: claim.reasoning ?? null,
          context_note: claim.context ?? null,
          is_current: true,
        },
        { onConflict: "article_id,external_id" },
      )
      .select("id")
      .single();

    if (claimErr || !claimRow) {
      console.error("[supabase] claim upsert failed:", claimErr?.message);
      continue;
    }

    const claimDbId = claimRow.id as string;
    const evidenceRows = [];

    for (const ev of claim.evidence) {
      const sourceUuid = await resolveSourceUuid(ev.sourceId);
      if (!sourceUuid) continue;
      evidenceRows.push({
        claim_id: claimDbId,
        source_id: sourceUuid,
        external_id: ev.id,
        excerpt: ev.excerpt,
        stance: ev.stance,
        url: ev.url,
        published_at: ev.publishedAt ?? null,
        is_direct_quote: ev.isDirectQuote ?? false,
        citation_label: ev.citationLabel ?? null,
      });
    }

    if (evidenceRows.length > 0) {
      const { error: evErr } = await supabase
        .from("claim_evidence")
        .upsert(evidenceRows, { onConflict: "claim_id,external_id" });
      if (evErr) console.error("[supabase] evidence upsert failed:", evErr.message);
    }
  }
}
