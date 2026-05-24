import { cn } from "@/lib/utils";

export const OSCAR_LOGO_SRC = "/oscar-logo.png";

type OscarLogoSize = "header" | "hero" | "auth";

const sizeClass: Record<OscarLogoSize, string> = {
  header: "h-8 w-auto max-w-[11rem] sm:max-w-[13rem]",
  hero: "h-16 w-auto max-w-md sm:h-20",
  auth: "h-14 w-auto max-w-sm",
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
      width={320}
      height={80}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={cn("object-contain object-left", sizeClass[size], className)}
    />
  );
}
