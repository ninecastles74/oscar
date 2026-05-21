import { CLUSTERS } from "./clusters";
import { STORIES } from "./stories";
import { SOURCES } from "./sources";

export type StageId =
  | "fetch" | "normalize" | "dedupe" | "cluster" | "rank"
  | "extract" | "evidence" | "compare" | "detect" | "report";

export interface StageDef {
  id: StageId;
  title: string;
  description: string;
  input: string;
  output: string;
  durationMs: number;
}

export const STAGES: StageDef[] = [
  { id: "fetch", title: "Fetch articles", description: "Pull from NewsAPI, GNews, The Guardian, RSS feeds, and approved publisher feeds.", input: "5 feeds", output: "raw articles", durationMs: 1200 },
  { id: "normalize", title: "Normalize", description: "Coerce heterogeneous payloads into a common Article schema.", input: "raw articles", output: "normalized articles", durationMs: 700 },
  { id: "dedupe", title: "Deduplicate", description: "Hash + URL canonicalization to drop syndicated copies.", input: "normalized", output: "unique articles", durationMs: 600 },
  { id: "cluster", title: "Cluster by event", description: "Embed and group articles describing the same underlying story.", input: "unique articles", output: "story clusters", durationMs: 1400 },
  { id: "rank", title: "Rank top 100", description: "Score clusters by coverage breadth, recency, and source diversity.", input: "story clusters", output: "top 100", durationMs: 500 },
  { id: "extract", title: "Extract claims", description: "LLM extracts verifiable factual claims from each cluster.", input: "top 100", output: "claim set", durationMs: 1800 },
  { id: "evidence", title: "Retrieve evidence", description: "Search approved sources for supporting and contradicting passages.", input: "claim set", output: "evidence pool", durationMs: 1600 },
  { id: "compare", title: "Compare sources", description: "Build claim-by-source matrix and agreement scores.", input: "evidence pool", output: "comparison matrix", durationMs: 900 },
  { id: "detect", title: "Detect issues", description: "Flag contradictions, missing context, emotional language, unsupported claims.", input: "comparison matrix", output: "issue flags", durationMs: 1100 },
  { id: "report", title: "Generate report", description: "Compose final per-cluster analysis with confidence and citations.", input: "all of the above", output: "final reports", durationMs: 800 },
];

export const FEEDS = [
  { id: "newsapi", name: "NewsAPI", kind: "API", color: "bg-blue-500" },
  { id: "gnews", name: "GNews", kind: "API", color: "bg-emerald-500" },
  { id: "guardian", name: "The Guardian", kind: "API", color: "bg-rose-500" },
  { id: "rss", name: "RSS feeds", kind: "RSS", color: "bg-amber-500" },
  { id: "publishers", name: "Approved publishers", kind: "Feed", color: "bg-violet-500" },
] as const;

export interface PipelineMetrics {
  fetched: number;
  normalized: number;
  unique: number;
  clusters: number;
  top: number;
  claims: number;
  evidence: number;
  comparisons: number;
  issues: { contradictions: number; missingContext: number; emotional: number; unsupported: number };
  reports: number;
}

export function computeMetrics(): PipelineMetrics {
  const fetched = 4318;
  const normalized = 4302;
  const unique = 1247;
  const clusters = CLUSTERS.length * 4;
  const claims = CLUSTERS.reduce((a, c) => a + c.claimIds.length, 0) * 3;
  const evidence = claims * 4;
  return {
    fetched, normalized, unique, clusters,
    top: 100,
    claims, evidence,
    comparisons: claims,
    issues: {
      contradictions: CLUSTERS.reduce((a, c) => a + c.disputedClaims, 0),
      missingContext: CLUSTERS.reduce((a, c) => a + c.missingContext, 0),
      emotional: 23,
      unsupported: 14,
    },
    reports: CLUSTERS.length,
  };
}

export interface SampleArticle {
  id: string;
  source: string;
  headline: string;
  url: string;
  fetchedAt: string;
  cluster?: string;
}

export function sampleRawArticles(): SampleArticle[] {
  return STORIES.slice(0, 12).map((s, i) => ({
    id: s.id,
    source: FEEDS[i % FEEDS.length].name,
    headline: s.headline,
    url: s.url,
    fetchedAt: new Date(Date.now() - i * 60_000).toISOString(),
    cluster: s.clusterId,
  }));
}

export function sampleNormalized() {
  return sampleRawArticles().slice(0, 3).map((a) => ({
    id: a.id,
    title: a.headline,
    source: a.source,
    published_at: a.fetchedAt,
    canonical_url: a.url,
    language: "en",
    body_hash: "sha256:" + a.id.padEnd(8, "0"),
  }));
}

export function sampleClusters() {
  return CLUSTERS.slice(0, 5).map((c) => ({
    id: c.id,
    title: c.title,
    members: c.storyCount,
    sources: Array.from(
      new Set(
        STORIES.filter((s) => s.clusterId === c.id).map(
          (s) => SOURCES.find((src) => src.id === s.sourceId)!.name,
        ),
      ),
    ).slice(0, 5),
    score: c.trendingScore,
  }));
}
