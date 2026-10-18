"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { SOURCE_CATALOG } from "@/app/data/catalog";
import { articleImages } from "@/app/lib/article-images";
import { createPhotoLoader, resolvePhoto } from "@/app/lib/photo-loader";
import { LocalizedText } from "./Localization";
import { usePagePreparation } from "./InitialLoadBoundary";

const nativeSources = new Set(SOURCE_CATALOG.map(source => source.id));
// Separate queues let recovery proceed while a publisher's downloads are stalled.
const direct = createPhotoLoader(() => new Image(), 8);
const recoverOnce = createPhotoLoader(() => new Image(), 4);
const recover = async (url: string) => {
  const result = await recoverOnce(url);
  if (result) return result;
  await new Promise(resolve => setTimeout(resolve, 700));
  return recoverOnce(url);
};

export const ArticleImage = memo(function ArticleImage({ image, fallbacks, region, sourceId, articleId, articleLink }: {
  image: string | null; fallbacks?: string[]; region: string; sourceId: string; articleId: string; articleLink: string;
}) {
  const { preparing, begin } = usePagePreparation();
  const candidates = useMemo(() => articleImages(image, fallbacks), [image, fallbacks]);
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!frame.current || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "1800px" });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const active = preparing || near;
  const proxy = (nativeSources.has(sourceId) || sourceId.startsWith("radar:")) ? `/api/article-image?${new URLSearchParams({ sourceId, articleId, articleLink })}` : null;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const end = begin();
    // Bound only the opening screen; a late successful download can still be used.
    const deadline = setTimeout(end, 12000);
    void resolvePhoto(candidates, proxy, direct, recover).then(url => {
      if (alive && url) setSrc(url);
      clearTimeout(deadline); end();
    });
    return () => { alive = false; clearTimeout(deadline); end(); };
  }, [active, candidates, proxy, begin]);
  return <div ref={frame} className={`article-image ${!src ? "image-unavailable" : ""}`}>
    {src ? <img src={src} alt="" width={640} height={360} loading="eager" decoding="async" referrerPolicy="no-referrer" /> : null}
    <span className="image-category"><LocalizedText>{region}</LocalizedText></span>
  </div>;
});
