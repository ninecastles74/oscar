import { BRAND_ACRONYM, BRAND_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {BRAND_NAME} · {BRAND_ACRONYM}
        </span>
        <span>Mock data for demonstration · v0.1</span>
      </div>
    </footer>
  );
}
