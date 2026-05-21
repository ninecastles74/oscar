import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClickableScore({
  score,
  label,
  sublabel,
  onClick,
  className,
}: {
  score: number;
  label: string;
  sublabel?: string;
  onClick: () => void;
  className?: string;
}) {
  const color =
    score >= 80
      ? "text-success"
      : score >= 60
        ? "text-accent"
        : score >= 40
          ? "text-warning"
          : "text-destructive";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border bg-card p-4 text-left transition-colors hover:border-accent/50 hover:bg-secondary/30",
        className,
      )}
      aria-label={`${label}: ${score}. Click for explanation.`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {sublabel && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</div>
          )}
        </div>
        <Info className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:text-accent" />
      </div>
      <div className={cn("mt-2 font-mono text-3xl font-semibold tabular-nums", color)}>
        {score}
        <span className="text-lg text-muted-foreground">/100</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground group-hover:text-foreground/80">
        Click to see why this score exists, how it was calculated, and contributing evidence
      </p>
    </button>
  );
}
