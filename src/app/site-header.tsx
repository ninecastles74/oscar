import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { OscarLogo } from "@/components/oscar-logo";
import { NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Link to="/" className="shrink-0 py-1" aria-label="OSCAR home">
          <OscarLogo size="header" priority />
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((n) => {
            const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-secondary text-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
