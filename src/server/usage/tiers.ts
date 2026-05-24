export type SubscriptionTier = "free" | "pro" | "team";

export interface TierLimits {
  dailyAiAnalyses: number;
  label: string;
  priceLabel: string;
  requiresLogin: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    dailyAiAnalyses: 5,
    label: "Free",
    priceLabel: "$0",
    requiresLogin: false,
  },
  pro: {
    dailyAiAnalyses: 30,
    label: "Pro",
    priceLabel: "$12/mo",
    requiresLogin: true,
  },
  team: {
    dailyAiAnalyses: 100,
    label: "Team",
    priceLabel: "$49/mo",
    requiresLogin: true,
  },
};

export function dailyLimitForTier(tier: SubscriptionTier): number {
  const envKey =
    tier === "free"
      ? "FREE_TIER_DAILY_AI_LIMIT"
      : tier === "pro"
        ? "PRO_TIER_DAILY_AI_LIMIT"
        : "TEAM_TIER_DAILY_AI_LIMIT";
  const raw = process.env[envKey];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return TIER_LIMITS[tier].dailyAiAnalyses;
}

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
