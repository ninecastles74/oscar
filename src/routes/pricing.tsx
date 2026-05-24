import { createFileRoute } from "@tanstack/react-router";
import { PricingView } from "@/features/auth/pricing-view";
import { OSCAR, pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: pageTitle(OSCAR.pricing) }] }),
  component: PricingView,
});
