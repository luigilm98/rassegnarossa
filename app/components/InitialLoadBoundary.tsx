"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { prepareImage } from "@/app/lib/image-readiness";

const Preparation = createContext({ preparing: false, begin: () => () => {} });
export const usePagePreparation = () => useContext(Preparation);

const labels: Record<string, [string, string, string]> = {
  it: ["Prepariamo la rassegna", "Raccolta delle fonti", "Preparazione di titoli e immagini"],
  en: ["Preparing your news", "Collecting sources", "Preparing headlines and images"],
  fr: ["Préparation de la revue", "Collecte des sources", "Préparation des titres et images"],
  es: ["Preparando la revista", "Recopilando fuentes", "Preparando titulares e imágenes"],
  pt: ["Preparando a revista", "Recolhendo fontes", "Preparando títulos e imagens"],
  de: ["Nachrichten werden vorbereitet", "Quellen werden gesammelt", "Titel und Bilder werden vorbereitet"],
  ru: ["Готовим новости", "Сбор источников", "Подготовка заголовков и изображений"],
  zh: ["正在准备新闻", "正在收集来源", "正在准备标题和图片"],
  ja: ["ニュースを準備しています", "情報源を収集中", "見出しと画像を準備中"],
  ar: ["جارٍ إعداد الأخبار", "جارٍ جمع المصادر", "جارٍ إعداد العناوين والصور"],
};

/** Keep the full initial edition mounted for downloads, but inaccessible until it is ready. */
export function InitialLoadBoundary({ children, collecting, progress, language }: {
  children: ReactNode; collecting: boolean; progress: { done: number; total: number }; language: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const work = useRef(new Set<symbol>());
  const begin = useCallback(() => {
    const token = Symbol();
    work.current.add(token);
    return () => { work.current.delete(token); };
  }, []);
  const context = useMemo(() => ({ preparing: !revealed, begin }), [revealed, begin]);
  useEffect(() => {
    if (revealed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [revealed]);
  useEffect(() => {
    if (revealed || collecting || !root.current) return;
    const controller = new AbortController();
    let active = true;
    const assets = new Map<HTMLImageElement, boolean>();
    const prepareAssets = () => {
      for (const image of root.current?.querySelectorAll("img") ?? []) {
        if (assets.has(image)) continue;
        assets.set(image, false);
        void prepareImage(image, controller.signal).then(() => { assets.set(image, true); });
      }
    };
    prepareAssets();
    // Fonts have already been requested by the mounted edition. A failed font uses the CSS fallback.
    let fontsReady = !document.fonts;
    void document.fonts?.ready.then(() => { fontsReady = true; });
    const fontDeadline = setTimeout(() => { fontsReady = true; }, 12000);
    let quietSince = 0;
    const check = setInterval(() => {
      prepareAssets();
      const ready = [...assets.values()].every(Boolean) && fontsReady && work.current.size === 0 &&
        !root.current?.querySelector('[data-initial-pending="true"]');
      if (!ready) { quietSince = 0; return; }
      if (!quietSince) quietSince = Date.now();
      // Allow React to commit translated text before the one-time reveal.
      if (active && Date.now() - quietSince >= 250) setRevealed(true);
    }, 100);
    return () => { active = false; controller.abort(); clearInterval(check); clearTimeout(fontDeadline); };
  }, [collecting, revealed, language]);
  const copy = labels[language.split("-")[0]] ?? labels.en;
  return <Preparation.Provider value={context}>
    {!revealed ? <div className="initial-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="initial-loading-brand"><span>rassegna</span>rossa.</div>
      <h1>{copy[0]}</h1>
      <p>{collecting ? copy[1] : copy[2]}</p>
      {collecting ? <><progress max={progress.total || 1} value={progress.done} aria-label={copy[1]} /><small>{progress.done} / {progress.total}</small></> : <progress aria-label={copy[2]} />}
    </div> : null}
    <div ref={root} className={!revealed ? "edition-preparing" : undefined} inert={!revealed} aria-hidden={!revealed || undefined}>
      {children}
    </div>
  </Preparation.Provider>;
}
