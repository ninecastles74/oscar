import type { SubscriptionTier } from "./tiers";
import type { UserAnalysisKind } from "./types";

export interface UsageRecord {
  id: string;
  userId?: string;
  anonymousId?: string;
  kind: UserAnalysisKind;
  dayKey: string;
  requestId?: string;
  createdAt: string;
}

const usageByDay = new Map<string, UsageRecord[]>();
const userTiers = new Map<string, SubscriptionTier>();

function bucketKey(userId?: string, anonymousId?: string, dayKey?: string): string {
  const who = userId ? `u:${userId}` : `a:${anonymousId ?? "unknown"}`;
  return `${who}:${dayKey ?? ""}`;
}

export function setUserTier(userId: string, tier: SubscriptionTier): void {
  userTiers.set(userId, tier);
}

export function getUserTier(userId?: string): SubscriptionTier {
  if (!userId) return "free";
  return userTiers.get(userId) ?? "free";
}

export function countUsageForDay(userId?: string, anonymousId?: string, dayKey?: string): number {
  const key = bucketKey(userId, anonymousId, dayKey);
  return usageByDay.get(key)?.length ?? 0;
}

export function recordUsage(input: Omit<UsageRecord, "id" | "createdAt">): UsageRecord {
  const record: UsageRecord = {
    ...input,
    id: `use_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const key = bucketKey(input.userId, input.anonymousId, input.dayKey);
  const list = usageByDay.get(key) ?? [];
  list.push(record);
  usageByDay.set(key, list);
  return record;
}
