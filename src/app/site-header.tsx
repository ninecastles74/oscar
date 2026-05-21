import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-sm bg-foreground text-background font-serif text-sm font-bold">
            V
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">Veridict</span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            News Intelligence
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {NAV_ITEMS.map((n) => {
            const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
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
