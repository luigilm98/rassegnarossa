"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SOURCE_CATALOG } from "@/app/data/catalog";
import { articleImages } from "@/app/lib/article-images";
import { LocalizedText } from "./Localization";
import { usePagePreparation } from "./InitialLoadBoundary";

const nativeSources = new Set(SOURCE_CATALOG.filter(source => source.kind !== "radar").map(source => source.id));

export const ArticleImage = memo(function ArticleImage({ image, fallbacks, region, sourceId, articleId, articleLink }: {
  image: string | null; fallbacks?: string[]; region: string; sourceId: string; articleId: string; articleLink: string;
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
    ? `/api/article-image?${new URLSearchParams({ sourceId, articleId, articleLink })}` : null;
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // Prefer same-origin delivery: publisher hotlink restrictions must not decide whether a photo appears.
  const src = nativeSources.has(sourceId) && !near ? undefined :
    (proxy && !failed.has(proxy) ? proxy : undefined) ?? candidates.find(candidate => !failed.has(candidate));
  return <div ref={frame} className={`article-image ${!src ? "image-unavailable" : ""}`}>
    {src ? <img key={src} src={src} alt="" width={640} height={360}
      loading={preparing ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(previous => new Set([...previous, src]))}
    /> : null}
    <span className="image-category"><LocalizedText>{region}</LocalizedText></span>
  </div>;
});
