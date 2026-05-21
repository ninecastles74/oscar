import { AlertTriangle, CheckCircle2, HelpCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/mock-data";

const VERDICT_CONFIG = {
  supported: {
    label: "Supported",
    cls: "bg-success/10 text-success border-success/30",
    Icon: CheckCircle2,
  },
  disputed: {
    label: "Disputed",
    cls: "bg-warning/10 text-warning border-warning/30",
    Icon: AlertTriangle,
  },
  unclear: {
    label: "Unclear",
    cls: "bg-muted text-muted-foreground border-border",
    Icon: HelpCircle,
  },
  insufficient_evidence: {
    label: "Insufficient Evidence",
    cls: "bg-secondary text-muted-foreground border-border",
    Icon: MinusCircle,
  },
} as const satisfies Record<Verdict, { label: string; cls: string; Icon: typeof CheckCircle2 }>;

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { label, cls, Icon } = VERDICT_CONFIG[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        cls,
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
