import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { Cluster } from "@/lib/mock-data/types";
import { ArticleThumbnail } from "@/components/article-thumbnail";
import { ConfidenceBar } from "@/components/confidence-bar";
import { OSCAR } from "@/lib/brand";

const CATS = [
  "All",
  "Politics",
  "World",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Sports",
  "Climate",
  "Markets",
  "Entertainment",
];

type FeedDiagnostics = {
  feedKvBound?: boolean;
  feedStorage?: string;
  configuredProviders?: string[];
  missingConfiguration?: string[];
  recommendations?: string[];
  bootstrap?: { ran?: boolean; reason?: string };
};

export function Top100View({
  clusters,
  meta,
  usingLiveFeed,
  bootstrap,
  diagnostics,
}: {
  clusters: Cluster[];
  meta?: { lastIngestAt?: string; lastAnalysisAt?: string; top100Count?: number };
  usingLiveFeed?: boolean;
  bootstrap?: { ran?: boolean; reason?: string; providerErrors?: string[] };
  diagnostics?: FeedDiagnostics;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const list = clusters.filter(
    (c) => (cat === "All" || c.category === cat) && c.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{OSCAR.monitor}</div>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Top 100 stories</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Stories from major US and world outlets (Fox, ABC, NBC, CBS, CNN, WSJ, NYT, AP, BBC, and more), clustered
          by event. New articles get full Oscar analysis every 8 hours; older stories stay visible until they age out
          of the Top 100 by date.
        </p>
        {usingLiveFeed && meta?.lastIngestAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last ingest {new Date(meta.lastIngestAt).toLocaleString()}
            {meta.lastAnalysisAt
              ? ` · Last analysis ${new Date(meta.lastAnalysisAt).toLocaleString()}`
              : ""}
            {meta.top100Count != null ? ` · ${meta.top100Count} in feed` : ""}
          </p>
        )}
        {!usingLiveFeed && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
            <p className="font-medium">Showing sample stories — live feed is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {bootstrap?.ran
                ? `Bootstrap ingest ran (${bootstrap.reason}). Refresh in a moment.`
                : bootstrap?.reason
                  ? `Bootstrap: ${bootstrap.reason}.`
                  : "Configure Cloudflare vars and KV, then open this page again or wait for the 8h cron."}
            </p>
            {diagnostics?.missingConfiguration && diagnostics.missingConfiguration.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                {diagnostics.missingConfiguration.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {diagnostics?.recommendations && diagnostics.recommendations.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                {diagnostics.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clusters…"
            className="w-full rounded-md border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                cat === c ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[40px_72px_1fr_160px_120px_160px_120px] gap-4 border-b bg-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div>#</div>
          <div aria-hidden />
          <div>Story</div>
          <div>Outlet</div>
          <div>Category</div>
          <div>Confidence</div>
          <div>Flags</div>
        </div>
        <div className="divide-y">
          {list.map((c, i) => {
            const singleArticleId =
              c.storyCount === 1 && c.storyIds?.[0] ? c.storyIds[0] : undefined;
            const href = singleArticleId
              ? ({
                  to: "/stories/$clusterId/$articleId" as const,
                  params: { clusterId: c.id, articleId: singleArticleId },
                } as const)
              : ({
                  to: "/consensus/$clusterId" as const,
                  params: { clusterId: c.id },
                } as const);

            return (
            <Link
              key={c.id}
              {...href}
              className="grid grid-cols-[40px_72px_1fr_160px_120px_160px_120px] items-center gap-4 px-4 py-4 transition-colors hover:bg-secondary/40"
            >
              <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <ArticleThumbnail src={c.imageUrl} alt="" className="h-14 w-[72px] rounded-md object-cover" />
              <div>
                <div className="text-sm font-semibold leading-snug">{c.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.storyCount > 1
                    ? `${c.storyCount} sources`
                    : c.primarySourceName
                      ? "1 source"
                      : "1 source"}{" "}
                  · updated{" "}
                  {new Date(c.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="text-xs font-medium leading-snug">
                {c.storyCount > 1 && c.sourceNames && c.sourceNames.length > 1
                  ? `${c.primarySourceName ?? c.sourceNames[0]} +${c.sourceNames.length - 1}`
                  : c.primarySourceName ?? c.sourceNames?.[0] ?? "—"}
              </div>
              <div className="text-xs">{c.category}</div>
              <div><ConfidenceBar value={c.confidence} label="" /></div>
              <div className="flex flex-wrap gap-1">
                {c.disputedClaims > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                    <AlertTriangle className="h-3 w-3" /> {c.disputedClaims}
                  </span>
                )}
                {c.missingContext > 0 && (
                  <span className="rounded-full border bg-secondary px-2 py-0.5 text-[10px] font-medium">
                    Context: {c.missingContext}
                  </span>
                )}
              </div>
            </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
