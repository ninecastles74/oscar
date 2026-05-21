import { cn } from "@/lib/utils";

export function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const color =
    value >= 80 ? "bg-success" : value >= 60 ? "bg-accent" : value >= 40 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label ?? "Confidence"}</span>
        <span className="font-mono tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
