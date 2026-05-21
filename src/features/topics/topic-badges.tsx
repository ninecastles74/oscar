import type { TopicClassification } from "@/types/news-platform";
import { cn } from "@/lib/utils";

export function TopicBadges({
  classification,
  className,
}: {
  classification?: TopicClassification;
  className?: string;
}) {
  if (!classification?.topics.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {classification.topics.map((t) => (
        <span
          key={t.topic}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            t.topic === classification.primaryTopic
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-muted bg-secondary/50 text-muted-foreground",
          )}
          title={`${t.topic} — ${t.confidence}% confidence`}
        >
          {t.topic}
          <span className="font-mono tabular-nums opacity-80">{t.confidence}%</span>
        </span>
      ))}
    </div>
  );
}
