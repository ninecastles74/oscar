import { cn } from "@/lib/utils";

export const OSCAR_LOGO_SRC = "/oscar-logo.png";

type OscarLogoSize = "header" | "hero" | "auth";

const sizeClass: Record<OscarLogoSize, string> = {
  header: "h-9 w-auto max-w-[14rem] sm:max-w-[18rem]",
  hero: "h-20 w-auto max-w-2xl sm:h-24",
  auth: "h-16 w-auto max-w-md",
};

export function OscarLogo({
  size = "header",
  className,
  priority,
}: {
  size?: OscarLogoSize;
  className?: string;
  /** Set on above-the-fold marks (header, hero). */
  priority?: boolean;
}) {
  return (
    <img
      src={OSCAR_LOGO_SRC}
      alt="OSCAR — Observational Source Consensus & Analysis Review"
      width={560}
      height={140}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("object-contain object-left", sizeClass[size], className)}
    />
  );
}
