"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SOURCE_CATALOG } from "@/app/data/catalog";
import { articleImages } from "@/app/lib/article-images";
import { LocalizedText } from "./Localization";
import { usePagePreparation } from "./InitialLoadBoundary";

const nativeSources = new Set(SOURCE_CATALOG.filter(source => source.kind !== "radar").map(source => source.id));

export const ArticleImage = memo(function ArticleImage({ image, fallbacks, region, sourceId, articleId }: {
  image: string | null; fallbacks?: string[]; region: string; sourceId: string; articleId: string;
}) {
  const { preparing } = usePagePreparation();
  const candidates = useMemo(() => articleImages(image, fallbacks), [image, fallbacks]);
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!frame.current || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const proxy = near && nativeSources.has(sourceId)
    ? `/api/article-image?${new URLSearchParams({ sourceId, articleId })}` : null;
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const src = candidates.find(candidate => !failed.has(candidate)) ?? (proxy && !failed.has(proxy) ? proxy : undefined);
  return <div ref={frame} className={`article-image ${!src ? "image-unavailable" : ""}`}>
    {src ? <img key={src} src={src} alt="" width={640} height={360}
      loading={preparing ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(previous => new Set([...previous, src]))}
    /> : null}
    <span className="image-category"><LocalizedText>{region}</LocalizedText></span>
  </div>;
});
