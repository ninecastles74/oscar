import type { ArticleSource } from "@/types/news-platform";
import { AUTHORS, type MockAuthor } from "@/lib/mock-data/authors";
import { APPROVED_SOURCES } from "../analysis/sources";
import {
  getAuthorScores,
  getLatestAuthor,
  getLatestOrganization,
  listAllAuthorIds,
  listAllOrganizationIds,
} from "../reliability/store";
import { organizationIdFromDomain } from "../reliability/utils/entity-ids";
import { getSupabaseAdmin } from "../supabase/client";

export type ScoreSource = "computed" | "registry" | "database";

export interface OrganizationDirectoryRow {
  sourceId: string;
  organizationId: string;
  name: string;
  domain: string;
  bias: string;
  approved: boolean;
  averageScore: number;
  rollingAverage: number | null;
  articlesScored: number;
  scoreSource: ScoreSource;
  trend: string | null;
}

export interface AuthorDirectoryRow {
  authorId: string;
  displayName: string;
  outlet: string | null;
  averageScore: number;
  rollingAverage: number | null;
  articlesScored: number;
  scoreSource: ScoreSource;
  trend: string | null;
}

export interface SourcesDirectory {
  organizations: OrganizationDirectoryRow[];
  authors: AuthorDirectoryRow[];
  meta: {
    organizationCount: number;
    authorCount: number;
    computedOrganizationCount: number;
    computedAuthorCount: number;
    supabaseMerged: boolean;
    usingMockAuthors: boolean;
  };
}

type DbSourceScore = {
  source_id: string;
  overall_score: number;
  rolling_average: number;
  articles_scored: number;
  trend_direction: string;
};

type DbAuthorScore = {
  author_id: string;
  overall_score: number;
  rolling_average: number;
  articles_scored: number;
  trend_direction: string;
};

function orgMetaFromId(organizationId: string): { name: string; domain: string } {
  const domain = organizationId.replace(/^org_/, "").replace(/_/g, ".");
  const src = APPROVED_SOURCES.find((s) => organizationIdFromDomain(s.domain) === organizationId);
  return { name: src?.name ?? domain, domain: src?.domain ?? domain };
}

function organizationIdFromSource(s: ArticleSource): string {
  return organizationIdFromDomain(s.domain);
}

function rowFromRegistry(s: ArticleSource): OrganizationDirectoryRow {
  const organizationId = organizationIdFromSource(s);
  const computed = getLatestOrganization(organizationId);
  return {
    sourceId: s.id,
    organizationId,
    name: s.name,
    domain: s.domain,
    bias: s.bias,
    approved: s.approved,
    averageScore: computed?.overallScore ?? s.reliability,
    rollingAverage: computed?.rollingAverage ?? null,
    articlesScored: computed?.articlesScored ?? 0,
    scoreSource: computed ? "computed" : "registry",
    trend: computed?.trend?.direction ?? null,
  };
}

function rowFromAuthorMock(a: MockAuthor): AuthorDirectoryRow {
  const computed = getLatestAuthor(a.authorId);
  return {
    authorId: a.authorId,
    displayName: computed?.displayName ?? a.displayName,
    outlet: a.outlet,
    averageScore: computed?.overallScore ?? a.reliability,
    rollingAverage: computed?.rollingAverage ?? null,
    articlesScored: computed?.articlesScored ?? 0,
    scoreSource: computed ? "computed" : "registry",
    trend: computed?.trend?.direction ?? null,
  };
}

type DbAuthorEntry = DbAuthorScore & {
  displayName: string;
  hasScore: boolean;
};

async function loadSupabaseScoreMaps(): Promise<{
  byDomain: Map<string, DbSourceScore & { name: string; bias: string; approved: boolean; slug: string }>;
  byAuthorSlug: Map<string, DbAuthorEntry>;
  importedAuthorCount: number;
} | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const [{ data: sources, error: srcErr }, { data: sourceScores, error: ssErr }, { data: authors, error: authErr }, { data: authorScores, error: asErr }] =
    await Promise.all([
      supabase.from("sources").select("id, slug, name, domain, bias, reliability, approved"),
      supabase
        .from("source_scores")
        .select("source_id, overall_score, rolling_average, articles_scored, trend_direction")
        .eq("is_current", true)
        .eq("topic", "General"),
      supabase.from("authors").select("id, slug, display_name"),
      supabase
        .from("author_scores")
        .select("author_id, overall_score, rolling_average, articles_scored, trend_direction")
        .eq("is_current", true)
        .eq("topic", "General"),
    ]);

  if (srcErr || ssErr || authErr || asErr) {
    console.error("[sources-directory] Supabase query failed:", srcErr?.message ?? ssErr?.message ?? authErr?.message ?? asErr?.message);
    return null;
  }

  const scoreBySourceId = new Map((sourceScores ?? []).map((s) => [s.source_id, s as DbSourceScore]));
  const byDomain = new Map<
    string,
    DbSourceScore & { name: string; bias: string; approved: boolean; slug: string }
  >();
  for (const src of sources ?? []) {
    const score = scoreBySourceId.get(src.id);
    if (!score) continue;
    byDomain.set(src.domain, {
      ...score,
      name: src.name,
      bias: src.bias,
      approved: src.approved,
      slug: src.slug,
    });
  }

  const scoreByAuthorId = new Map((authorScores ?? []).map((s) => [s.author_id, s as DbAuthorScore]));
  const byAuthorSlug = new Map<string, DbAuthorEntry>();
  for (const author of authors ?? []) {
    const score = scoreByAuthorId.get(author.id);
    if (score) {
      byAuthorSlug.set(author.slug, {
        ...score,
        displayName: author.display_name,
        hasScore: true,
      });
    } else {
      byAuthorSlug.set(author.slug, {
        author_id: author.id,
        overall_score: 0,
        rolling_average: 0,
        articles_scored: 0,
        trend_direction: "stable",
        displayName: author.display_name,
        hasScore: false,
      });
    }
  }

  return { byDomain, byAuthorSlug, importedAuthorCount: authors?.length ?? 0 };
}

function hasInMemoryRealAuthors(): boolean {
  for (const authorId of listAllAuthorIds()) {
    if (getLatestAuthor(authorId) || getAuthorScores(authorId).length > 0) return true;
  }
  return false;
}

function hasRealImportedAuthors(db: Awaited<ReturnType<typeof loadSupabaseScoreMaps>>): boolean {
  if (hasInMemoryRealAuthors()) return true;
  return (db?.importedAuthorCount ?? 0) > 0;
}

function rowFromDbAuthor(slug: string, hit: DbAuthorEntry): AuthorDirectoryRow {
  return {
    authorId: slug,
    displayName: hit.displayName,
    outlet: null,
    averageScore: hit.hasScore ? hit.overall_score : 0,
    rollingAverage: hit.hasScore ? hit.rolling_average : null,
    articlesScored: hit.hasScore ? hit.articles_scored : 0,
    scoreSource: hit.hasScore ? "database" : "registry",
    trend: hit.hasScore ? hit.trend_direction : null,
  };
}

function buildRealAuthorRows(db: NonNullable<Awaited<ReturnType<typeof loadSupabaseScoreMaps>>>): AuthorDirectoryRow[] {
  const map = new Map<string, AuthorDirectoryRow>();

  for (const authorId of listAllAuthorIds()) {
    const computed = getLatestAuthor(authorId);
    if (!computed) continue;
    map.set(authorId, {
      authorId,
      displayName: computed.displayName,
      outlet: null,
      averageScore: computed.overallScore,
      rollingAverage: computed.rollingAverage,
      articlesScored: computed.articlesScored,
      scoreSource: "computed",
      trend: computed.trend?.direction ?? null,
    });
  }

  for (const [slug, hit] of db.byAuthorSlug) {
    const existing = map.get(slug);
    if (existing?.scoreSource === "computed") {
      if (hit.hasScore) {
        map.set(slug, {
          ...existing,
          averageScore: hit.overall_score,
          rollingAverage: hit.rolling_average,
          articlesScored: hit.articles_scored,
          scoreSource: "database",
          trend: hit.trend_direction,
        });
      }
      continue;
    }
    map.set(slug, rowFromDbAuthor(slug, hit));
  }

  return [...map.values()];
}

function applySupabaseToOrganizations(
  rows: OrganizationDirectoryRow[],
  db: NonNullable<Awaited<ReturnType<typeof loadSupabaseScoreMaps>>>,
): OrganizationDirectoryRow[] {
  return rows.map((row) => {
    const hit = db.byDomain.get(row.domain);
    if (!hit) return row;
    return {
      ...row,
      sourceId: hit.slug || row.sourceId,
      name: hit.name || row.name,
      bias: hit.bias || row.bias,
      approved: hit.approved,
      averageScore: hit.overall_score,
      rollingAverage: hit.rolling_average,
      articlesScored: hit.articles_scored,
      scoreSource: "database",
      trend: hit.trend_direction,
    };
  });
}

/** Build public Sources directory from registry, mock authors, in-memory scores, and optional Supabase. */
export async function buildSourcesDirectory(): Promise<SourcesDirectory> {
  const orgMap = new Map<string, OrganizationDirectoryRow>();
  for (const s of APPROVED_SOURCES) {
    const row = rowFromRegistry(s);
    orgMap.set(row.organizationId, row);
  }

  for (const organizationId of listAllOrganizationIds()) {
    if (orgMap.has(organizationId)) continue;
    const computed = getLatestOrganization(organizationId);
    if (!computed) continue;
    const meta = orgMetaFromId(organizationId);
    orgMap.set(organizationId, {
      sourceId: organizationId,
      organizationId,
      name: computed.name || meta.name,
      domain: computed.domain || meta.domain,
      bias: "unknown",
      approved: true,
      averageScore: computed.overallScore,
      rollingAverage: computed.rollingAverage,
      articlesScored: computed.articlesScored,
      scoreSource: "computed",
      trend: computed.trend?.direction ?? null,
    });
  }

  let organizations = [...orgMap.values()].sort((a, b) => b.averageScore - a.averageScore);

  const db = await loadSupabaseScoreMaps();
  const supabaseMerged = Boolean(db);
  const useMockAuthors = !hasRealImportedAuthors(db);

  let authors: AuthorDirectoryRow[];
  if (useMockAuthors) {
    authors = AUTHORS.map((a) => rowFromAuthorMock(a));
  } else if (db) {
    authors = buildRealAuthorRows(db);
  } else {
    authors = buildRealAuthorRows({
      byDomain: new Map(),
      byAuthorSlug: new Map(),
      importedAuthorCount: 0,
    });
  }

  if (db) {
    organizations = applySupabaseToOrganizations(organizations, db).sort(
      (a, b) => b.averageScore - a.averageScore,
    );
  }

  authors = authors.sort((a, b) => b.averageScore - a.averageScore);

  const computedOrganizationCount = organizations.filter((o) => o.scoreSource !== "registry").length;
  const computedAuthorCount = authors.filter((a) => a.scoreSource !== "registry").length;

  return {
    organizations,
    authors,
    meta: {
      organizationCount: organizations.length,
      authorCount: authors.length,
      computedOrganizationCount,
      computedAuthorCount,
      supabaseMerged,
      usingMockAuthors: useMockAuthors,
    },
  };
}
