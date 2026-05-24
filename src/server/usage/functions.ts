import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listPublicTiers, getQuotaStatus, resolveActor } from "./quota";

const actorSchema = z.object({
  accessToken: z.string().optional(),
  anonymousId: z.string().max(128).optional(),
});

export const getAiUsageQuota = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => actorSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const actor = await resolveActor({
      accessToken: data?.accessToken,
      anonymousId: data?.anonymousId,
    });
    const quota = await getQuotaStatus(actor);
    return { quota, tiers: listPublicTiers() };
  });
