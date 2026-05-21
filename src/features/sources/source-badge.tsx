import { cn } from "@/lib/utils";
import type { Source } from "@/lib/mock-data";

const BIAS_COLOR: Record<string, string> = {
  left: "bg-blue-500",
  "center-left": "bg-blue-400",
  center: "bg-muted-foreground",
  "center-right": "bg-rose-400",
  right: "bg-rose-500",
  unknown: "bg-gray-400",
};

export function SourceBadge({ source, small }: { source: Source; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs",
        small && "px-1.5 py-0.5 text-[11px]",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", BIAS_COLOR[source.bias])} />
      <span className="font-medium">{source.name}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{source.reliability}</span>
    </span>
  );
}
