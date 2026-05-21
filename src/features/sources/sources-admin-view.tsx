import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { SOURCES, type Source } from "@/lib/mock-data";

export function SourcesAdminView() {
  const [list, setList] = useState<Source[]>(SOURCES);

  const toggle = (id: string) =>
    setList((l) => l.map((s) => (s.id === id ? { ...s, approved: !s.approved } : s)));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Admin</div>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Approved sources</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Sources used for cross-reference analysis. Reliability scores are aggregated from third-party media monitors.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90">
          <Plus className="h-4 w-4" /> Add source
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-secondary/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Domain</th>
              <th className="px-4 py-3 text-left">Bias</th>
              <th className="px-4 py-3 text-left">Reliability</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.domain}</td>
                <td className="px-4 py-3 text-xs capitalize">{s.bias.replace("-", " ")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${s.reliability >= 90 ? "bg-success" : s.reliability >= 80 ? "bg-accent" : "bg-warning"}`}
                        style={{ width: `${s.reliability}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums">{s.reliability}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(s.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      s.approved
                        ? "border-success/30 bg-success/10 text-success"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.approved && <Check className="h-3 w-3" />}
                    {s.approved ? "Approved" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
