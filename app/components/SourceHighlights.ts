"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SOURCE_CATALOG } from "@/app/data/catalog";
import { highlightSources, type SourceHighlight, type SourceImage } from "@/app/lib/source-highlights";

/** Only publishers with received articles are consulted; never delays the feed queue. */
export function useSourceHighlights(articles: { sourceId: string; sourceHomepage: string }[], enabled: boolean) {
  const sources = useMemo(() => highlightSources(SOURCE_CATALOG, articles), [articles]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const [highlights, setHighlights] = useState<SourceHighlight[]>([]);
  const [images, setImages] = useState<SourceImage[]>([]);
  const [coverage, setCoverage] = useState({ done: 0, ok: 0, total: 0, busy: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const attempted = new Map<string, number>();
    const inFlight = new Set<string>();
    const results = new Map<string, { ok: boolean; highlights: SourceHighlight[]; images: SourceImage[] }>();
    let active = true;
    const report = () => {
      if (!active) return;
      const current = sourcesRef.current;
      const next = {
        done: current.filter(source => results.has(source.homepage)).length,
        ok: current.filter(source => results.get(source.homepage)?.ok).length,
        total: current.length,
        busy: inFlight.size > 0 || current.some(source => !attempted.has(source.homepage)),
      };
      setCoverage(previous => previous.done === next.done && previous.ok === next.ok && previous.total === next.total && previous.busy === next.busy ? previous : next);
    };
    const pump = () => {
      if (!active || document.visibilityState !== "visible") return;
      for (const source of sourcesRef.current) {
        if (inFlight.size >= 3) break;
        if (inFlight.has(source.homepage) || Date.now() - (attempted.get(source.homepage) ?? 0) < 600_000) continue;
        attempted.set(source.homepage, Date.now()); inFlight.add(source.homepage);
        void (async () => {
          let result = { ok: false, highlights: [] as SourceHighlight[], images: [] as SourceImage[] };
          try {
            const response = await fetch(`/api/highlights?sourceId=${encodeURIComponent(source.id)}`, {
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
            });
            const data = await response.json();
            if (response.ok && data.ok && Array.isArray(data.highlights))
              result = { ok: true, highlights: data.highlights.filter((item: SourceHighlight) =>
                typeof item.link === "string" && ["featured", "opening", "popular"].includes(item.placement) && Number.isFinite(item.rank)),
                images: Array.isArray(data.images) ? data.images.filter((item: SourceImage) => typeof item.link === "string" && typeof item.image === "string") : [] };
          } catch { /* One publisher cannot block articles or other publishers. */ }
          if (active) {
            results.set(source.homepage, result);
            setHighlights([...results.values()].flatMap(value => value.highlights));
            setImages([...results.values()].flatMap(value => value.images));
            inFlight.delete(source.homepage); report();
          }
        })();
      }
      report();
    };
    const delay = setTimeout(pump, 1500);
    const timer = setInterval(pump, 1000);
    return () => { active = false; controller.abort(); clearTimeout(delay); clearInterval(timer); };
  }, [enabled]);
  return { highlights, images, coverage: { ...coverage, busy: enabled && (coverage.busy || coverage.total < sources.length) } };
}
