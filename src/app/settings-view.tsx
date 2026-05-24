import { useState } from "react";
import { Copy, Eye, EyeOff, Key } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

const KEYS = [
  { id: "k1", name: "NewsAPI.org", env: "NEWS_API_KEY", value: "na_live_•••••••••••••••8h2k" },
  { id: "k2", name: "GDELT", env: "GDELT_KEY", value: "gd_•••••••••••••••a4m1" },
  { id: "k3", name: "OpenAI (claim extraction)", env: "OPENAI_API_KEY", value: "sk-•••••••••••••••w9q3" },
  { id: "k4", name: "Anthropic (verification)", env: "ANTHROPIC_API_KEY", value: "sk-ant-•••••••••••2bp7" },
  { id: "k5", name: "Supabase URL", env: "SUPABASE_URL", value: "https://••••••••.supabase.co" },
  { id: "k6", name: "Supabase service role", env: "SUPABASE_SERVICE_ROLE_KEY", value: "sb_•••••••••••••••" },
];

export function SettingsView() {
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [analysisDepth, setAnalysisDepth] = useState("standard");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
        <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{BRAND_NAME} workspace & API keys</h1>
      </div>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">Preferences</h2>
        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Scheduled Top 100 refresh</label>
              <p className="text-xs text-muted-foreground">
                News ingest + analysis runs automatically every 8 hours (server cron). Does not use your AI quota.
              </p>
            </div>
            <span className="rounded-md border bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
              Enabled via SCHEDULED_NEWS_ENABLED
            </span>
          </div>
          <div>
            <label className="text-sm font-medium">Analysis depth</label>
            <p className="mb-2 text-xs text-muted-foreground">Deeper analysis costs more credits per article.</p>
            <div className="grid grid-cols-3 gap-2">
              {["fast", "standard", "deep"].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalysisDepth(d)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    analysisDepth === d ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-secondary"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <Key className="h-5 w-5" />
          <h2 className="font-serif text-xl font-semibold">API keys</h2>
        </div>
        <div className="space-y-3">
          {KEYS.map((k) => (
            <div key={k.id} className="rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{k.name}</div>
                  <code className="text-[11px] text-muted-foreground">{k.env}</code>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-md border bg-card px-3 py-1.5 font-mono text-xs">
                    {show[k.id] ? k.value.replace(/•/g, "x") : k.value}
                  </code>
                  <button
                    onClick={() => setShow((s) => ({ ...s, [k.id]: !s[k.id] }))}
                    className="rounded-md border bg-card p-1.5 hover:bg-secondary"
                    aria-label="toggle"
                  >
                    {show[k.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button className="rounded-md border bg-card p-1.5 hover:bg-secondary" aria-label="copy">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Keys are stored encrypted at rest. Mock interface — no real keys are saved.
        </p>
      </section>
    </main>
  );
}
