import { ExternalLink } from "lucide-react";
import { sourceById, type Evidence } from "@/lib/mock-data";
import { SourceBadge } from "@/features/sources/source-badge";

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const s = sourceById(evidence.sourceId);
  return (
    <div className="rounded-lg border bg-card p-4">
      <SourceBadge source={s} small />
      <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic leading-relaxed text-foreground/85">
        "{evidence.excerpt}"
      </blockquote>
      <a href={evidence.url} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
        View source <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
