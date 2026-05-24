// Top-level navigation config used by the site header.
// Keep `to` values in sync with the route files in src/routes/.

import { OSCAR } from "@/lib/brand";

export const NAV_ITEMS = [
  { to: "/dashboard", label: OSCAR.signals },
  { to: "/stories", label: "Top 100" },
  { to: "/analyze", label: OSCAR.ask },
  { to: "/my-writing", label: OSCAR.myWriting },
  { to: "/pricing", label: "Plans" },
  { to: "/login", label: "Sign in" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
