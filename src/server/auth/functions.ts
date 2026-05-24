import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { upsertAppUser, verifyAccessToken } from "./session";
import { resolveActor, getQuotaStatus } from "../usage/quota";
import { setUserTier } from "../usage/store";
import type { SubscriptionTier } from "../usage/tiers";

const tokenSchema = z.object({
  accessToken: z.string().min(1),
  anonymousId: z.string().max(128).optional(),
});

/** Sync Supabase auth user to app_users and return quota. */
export const syncAuthSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await verifyAccessToken(data.accessToken);
    if (!auth?.user) {
      return { error: { code: "INVALID_SESSION", message: "Invalid or expired session." } };
    }
    await upsertAppUser(auth.user);
    const actor = await resolveActor({
      accessToken: data.accessToken,
      anonymousId: data.anonymousId,
    });
    const quota = await getQuotaStatus(actor);
    return {
      user: { id: auth.user.id, email: auth.user.email },
      tier: actor.tier,
      quota,
    };
  });

const tierSchema = z.object({
  accessToken: z.string().min(1),
  tier: z.enum(["pro", "team"]),
});

/** Dev/admin: set tier after checkout (replace with Stripe webhook later). */
export const setSubscriptionTier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tierSchema.parse(data))
  .handler(async ({ data }) => {
    const auth = await verifyAccessToken(data.accessToken);
    if (!auth?.user) {
      return { error: { code: "AUTH_REQUIRED", message: "Sign in required." } };
    }

    const tier = data.tier as SubscriptionTier;
    setUserTier(auth.user.id, tier);

    const supabase = (await import("../supabase/client")).getSupabaseAdmin();
    if (supabase) {
      await supabase.from("app_users").upsert(
        { id: auth.user.id, email: auth.user.email ?? "", tier },
        { onConflict: "id" },
      );
    }

    const actor = await resolveActor({ accessToken: data.accessToken });
    const quota = await getQuotaStatus(actor);
    return { tier, quota };
  });
