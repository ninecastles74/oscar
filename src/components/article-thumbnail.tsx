import { useState } from "react";
import { ImageOff } from "lucide-react";
import { normalizeImageUrl } from "@/lib/article-image";

export function ArticleThumbnail({
  src,
  alt,
  className = "h-14 w-20 shrink-0 rounded-md object-cover",
  fallbackClassName = "h-14 w-20 shrink-0 rounded-md border bg-muted",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = normalizeImageUrl(src);

  if (!url || failed) {
    return (
      <div
        className={`flex items-center justify-center text-muted-foreground ${fallbackClassName}`}
        aria-hidden
      >
        <ImageOff className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
