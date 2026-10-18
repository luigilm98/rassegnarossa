"use client";
import { memo, useMemo, useState } from "react";
import { articleImages } from "@/app/lib/article-images";
import { LocalizedText } from "./Localization";
import { usePagePreparation } from "./InitialLoadBoundary";

export const ArticleImage = memo(function ArticleImage({ image, fallbacks, region }: {
  image: string | null; fallbacks?: string[]; region: string;
}) {
  const { preparing } = usePagePreparation();
  const candidates = useMemo(() => articleImages(image, fallbacks), [image, fallbacks]);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const src = candidates.find(candidate => !failed.has(candidate));
  return <div className={`article-image ${!src ? "image-unavailable" : ""}`}>
    {src ? <img key={src} src={src} alt="" width={640} height={360}
      loading={preparing ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer"
      onError={() => setFailed(previous => new Set([...previous, src]))}
    /> : null}
    <span className="image-category"><LocalizedText>{region}</LocalizedText></span>
  </div>;
});
