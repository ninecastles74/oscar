// Top-level navigation config used by the site header.
// Keep `to` values in sync with the route files in src/routes/.

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/stories", label: "Top 100" },
  { to: "/analyze", label: "Analyze" },
  { to: "/admin/sources", label: "Sources" },
  { to: "/settings", label: "Settings" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
