import { Link } from "@tanstack/react-router";

export interface QuotaInfo {
  tier: string;
  limit: number;
  used: number;
  remaining: number;
  requiresLoginForMore?: boolean;
}

export function QuotaBanner({ quota }: { quota?: QuotaInfo | null }) {
  if (!quota) return null;

  return (
    <div className="mx-auto mb-6 max-w-3xl rounded-lg border bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">
          <span className="font-medium capitalize text-foreground">{quota.tier}</span> plan ·{" "}
          <span className="tabular-nums">
            {quota.remaining} of {quota.limit}
          </span>{" "}
          Oscar analyses left today
        </span>
        {quota.remaining === 0 && (
          <Link to="/pricing" className="text-xs font-semibold text-accent hover:underline">
            Upgrade →
          </Link>
        )}
        {quota.requiresLoginForMore && quota.remaining <= 1 && (
          <Link to="/login" className="text-xs font-semibold text-accent hover:underline">
            Sign in for paid tiers →
          </Link>
        )}
      </div>
    </div>
  );
}
