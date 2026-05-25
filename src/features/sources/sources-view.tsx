import { useState } from "react";
import { Building2, User } from "lucide-react";
import type { AuthorDirectoryRow, OrganizationDirectoryRow, SourcesDirectory } from "@/server/sources/directory";
import { OSCAR } from "@/lib/brand";
import { cn } from "@/lib/utils";

function scoreBarClass(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-accent";
  return "bg-warning";
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", scoreBarClass(score))} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums">{score}</span>
    </div>
  );
}

function scoreSourceLabel(source: OrganizationDirectoryRow["scoreSource"]): string {
  if (source === "database") return "Live DB";
  if (source === "computed") return "Analyzed";
  return "Registry";
}

function OrganizationsTable({ rows }: { rows: OrganizationDirectoryRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Organisation</th>
            <th className="px-4 py-3 text-left">Domain</th>
            <th className="px-4 py-3 text-left">Avg. score</th>
            <th className="px-4 py-3 text-right">Articles</th>
            <th className="px-4 py-3 text-right">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => (
            <tr key={s.organizationId}>
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.domain}</td>
              <td className="px-4 py-3 text-xs">{BIAS_LABEL[s.bias] ?? s.bias}</td>
              <td className="px-4 py-3">
                <ScoreBar score={s.averageScore} />
                {s.rollingAverage != null && s.rollingAverage !== s.averageScore ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Rolling {s.rollingAverage}
                    {s.trend ? ` · ${s.trend}` : ""}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {s.articlesScored > 0 ? s.articlesScored : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                {scoreSourceLabel(s.scoreSource)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuthorsTable({ rows }: { rows: AuthorDirectoryRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Author</th>
            <th className="px-4 py-3 text-left">Outlet</th>
            <th className="px-4 py-3 text-left">Avg. score</th>
            <th className="px-4 py-3 text-right">Articles</th>
            <th className="px-4 py-3 text-right">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((a) => (
            <tr key={a.authorId}>
              <td className="px-4 py-3 font-medium">{a.displayName}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.outlet ?? "—"}</td>
              <td className="px-4 py-3">
                <ScoreBar score={a.averageScore} />
                {a.rollingAverage != null && a.rollingAverage !== a.averageScore ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Rolling {a.rollingAverage}
                    {a.trend ? ` · ${a.trend}` : ""}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {a.articlesScored > 0 ? a.articlesScored : "—"}
              </td>
              <td className="px-4 py-3 text-right text-[10px] uppercase tracking-wide text-muted-foreground">
                {scoreSourceLabel(a.scoreSource)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Tab = "organizations" | "authors";

export function SourcesView({ directory }: { directory: SourcesDirectory }) {
  const [tab, setTab] = useState<Tab>("organizations");
  const { organizations, authors, meta } = directory;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{OSCAR.reliability}</div>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{OSCAR.sources}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Average reliability scores for approved news organisations and tracked authors. Registry baselines come from
          the publisher list; analyzed scores update after {OSCAR.ask} and scheduled verification runs.
          {meta.supabaseMerged ? " Live scores are merged from Supabase when configured." : ""}
          {meta.usingMockAuthors
            ? " Sample authors are shown until the first real author is imported or scored."
            : " Author list reflects imported and analyzed authors only."}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("organizations")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
            tab === "organizations" ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
          )}
        >
          <Building2 className="h-4 w-4" />
          Organisations
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs tabular-nums">{meta.organizationCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("authors")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
            tab === "authors" ? "bg-foreground text-background" : "bg-card hover:bg-secondary",
          )}
        >
          <User className="h-4 w-4" />
          Authors
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs tabular-nums">{meta.authorCount}</span>
        </button>
      </div>

      {tab === "organizations" ? (
        <OrganizationsTable rows={organizations} />
      ) : authors.length === 0 ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No authors yet. Import or score an author via analysis to populate this list.
        </div>
      ) : (
        <AuthorsTable rows={authors} />
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        {meta.computedOrganizationCount} organisation
        {meta.computedOrganizationCount === 1 ? "" : "s"} and {meta.computedAuthorCount} author
        {meta.computedAuthorCount === 1 ? "" : "s"} have analyzed or database-backed scores; others show registry
        baselines until articles are scored.
      </p>
    </main>
  );
}
