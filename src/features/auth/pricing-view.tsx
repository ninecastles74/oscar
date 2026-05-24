import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { OSCAR } from "@/lib/brand";
import { getAiUsageQuota } from "@/server/usage/functions";
import { getAccessToken, signOut } from "@/lib/auth-session";
import { setSubscriptionTier } from "@/server/auth/functions";
import { getAnonymousId } from "@/lib/anonymous-id";
import type { SubscriptionTier } from "@/server/usage/tiers";

interface TierCard {
  tier: SubscriptionTier;
  label: string;
  priceLabel: string;
  dailyLimit: number;
  requiresLogin: boolean;
}

export function PricingView() {
  const [tiers, setTiers] = useState<TierCard[]>([]);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>("free");
  const [signedIn, setSignedIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const token = await getAccessToken();
      setSignedIn(!!token);
      const res = await getAiUsageQuota({
        data: { accessToken: token, anonymousId: getAnonymousId() },
      });
      if (res?.tiers) setTiers(res.tiers as TierCard[]);
      if (res?.quota?.tier) setCurrentTier(res.quota.tier as SubscriptionTier);
    })();
  }, []);

  const selectTier = async (tier: "pro" | "team") => {
    const token = await getAccessToken();
    if (!token) {
      setMessage("Sign in first to upgrade.");
      return;
    }
    const res = await setSubscriptionTier({ data: { accessToken: token, tier } });
    if ("error" in res && res.error) {
      setMessage(res.error.message);
      return;
    }
    setCurrentTier(tier);
    setMessage(`Upgraded to ${tier} (dev placeholder — connect Stripe for production).`);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {OSCAR.pricing}
        </div>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">
          {OSCAR.analysis} limits
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
          Top 100 news and {OSCAR.monitor} refresh every 8 hours on our schedule — no quota cost.
          Ask Oscar uses your daily AI allowance.
        </p>
        {signedIn ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        ) : (
          <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
            Sign in for paid tiers →
          </Link>
        )}
      </div>

      {message && (
        <p className="mx-auto mt-6 max-w-lg rounded-md border bg-card px-4 py-2 text-center text-sm">
          {message}
        </p>
      )}

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.tier}
            className={`rounded-2xl border p-6 ${
              currentTier === t.tier ? "border-foreground shadow-md" : "bg-card"
            }`}
          >
            <h2 className="font-serif text-2xl font-semibold">{t.label}</h2>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{t.priceLabel}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.dailyLimit} Oscar analyses per day
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-success" />
                {OSCAR.ask}
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 shrink-0 text-success" />
                8h auto news (no quota)
              </li>
            </ul>
            {t.tier === "free" ? (
              <p className="mt-6 text-xs text-muted-foreground">No login required</p>
            ) : currentTier === t.tier ? (
              <p className="mt-6 text-xs font-semibold text-success">Current plan</p>
            ) : (
              <button
                type="button"
                onClick={() => void selectTier(t.tier as "pro" | "team")}
                className="mt-6 w-full rounded-md bg-foreground py-2.5 text-sm font-semibold text-background"
              >
                Upgrade to {t.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
