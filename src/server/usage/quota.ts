import { getSupabaseAdmin } from "../supabase/client";
import { isSupabaseConfigured } from "../supabase/config";
import { verifyAccessToken } from "../auth/session";
import {
  countUsageForDay,
  getUserTier,
  recordUsage,
  setUserTier,
} from "./store";
import {
  dailyLimitForTier,
  TIER_LIMITS,
  utcDayKey,
  type SubscriptionTier,
} from "./tiers";
import type { UserAnalysisKind } from "./types";

export interface UsageActor {
  userId?: string;
  email?: string;
  tier: SubscriptionTier;
  anonymousId?: string;
}

export interface QuotaStatus {
  tier: SubscriptionTier;
  limit: number;
  used: number;
  remaining: number;
  dayKey: string;
  requiresLoginForMore: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  status: QuotaStatus;
  message?: string;
}

async function syncTierFromDb(userId: string): Promise<SubscriptionTier> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return getUserTier(userId);

  const { data } = await supabase.from("app_users").select("tier").eq("id", userId).maybeSingle();
  if (data?.tier) {
    const tier = data.tier as SubscriptionTier;
    setUserTier(userId, tier);
    return tier;
  }
  return getUserTier(userId);
}

async function countUsageDb(
  dayKey: string,
  userId?: string,
  anonymousId?: string,
): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  let query = supabase
    .from("analysis_usage")
    .select("id", { count: "exact", head: true })
    .eq("day_key", dayKey);

  if (userId) query = query.eq("user_id", userId);
  else if (anonymousId) query = query.eq("anonymous_id", anonymousId);
  else return 0;

  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

async function persistUsageDb(record: {
  userId?: string;
  anonymousId?: string;
  kind: UserAnalysisKind;
  dayKey: string;
  requestId?: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("analysis_usage").insert({
    user_id: record.userId ?? null,
    anonymous_id: record.anonymousId ?? null,
    kind: record.kind,
    day_key: record.dayKey,
    request_id: record.requestId ?? null,
  });
}

export async function resolveActor(input: {
  accessToken?: string;
  anonymousId?: string;
}): Promise<UsageActor> {
  const auth = await verifyAccessToken(input.accessToken);
  if (auth?.user) {
    const tier = await syncTierFromDb(auth.user.id);
    return {
      userId: auth.user.id,
      email: auth.user.email,
      tier,
      anonymousId: input.anonymousId,
    };
  }
  return {
    tier: "free",
    anonymousId: input.anonymousId?.trim() || undefined,
  };
}

export async function getQuotaStatus(actor: UsageActor): Promise<QuotaStatus> {
  const dayKey = utcDayKey();
  const limit = dailyLimitForTier(actor.tier);
  const dbCount = await countUsageDb(dayKey, actor.userId, actor.anonymousId);
  const used =
    dbCount ??
    countUsageForDay(actor.userId, actor.anonymousId, dayKey);
  const remaining = Math.max(0, limit - used);

  return {
    tier: actor.tier,
    limit,
    used,
    remaining,
    dayKey,
    requiresLoginForMore: actor.tier === "free" && !actor.userId,
  };
}

export async function assertAiAnalysisQuota(actor: UsageActor): Promise<QuotaCheckResult> {
  const status = await getQuotaStatus(actor);
  if (status.remaining > 0) {
    return { allowed: true, status };
  }

  const message = status.requiresLoginForMore
    ? `Daily limit reached (${status.limit} Oscar analyses today). Sign in for paid tiers with higher limits.`
    : `Daily Oscar analysis limit reached (${status.limit}). Upgrade your plan for more.`;

  return { allowed: false, status, message };
}

export async function recordAiAnalysisUsage(input: {
  actor: UsageActor;
  kind: UserAnalysisKind;
  requestId: string;
}): Promise<void> {
  const dayKey = utcDayKey();
  recordUsage({
    userId: input.actor.userId,
    anonymousId: input.actor.anonymousId,
    kind: input.kind,
    dayKey,
    requestId: input.requestId,
  });
  await persistUsageDb({
    userId: input.actor.userId,
    anonymousId: input.actor.anonymousId,
    kind: input.kind,
    dayKey,
    requestId: input.requestId,
  });
}

export function listPublicTiers() {
  return (["free", "pro", "team"] as const).map((tier) => ({
    tier,
    ...TIER_LIMITS[tier],
    dailyLimit: dailyLimitForTier(tier),
  }));
}
