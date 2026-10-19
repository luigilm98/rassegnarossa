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
  const notify = useRef(() => {});
  const begin = useCallback(() => {
    const token = Symbol();
    work.current.add(token);
    notify.current();
    return () => { work.current.delete(token); notify.current(); };
  }, []);
  const context = useMemo(() => ({ preparing: !revealed, begin }), [revealed, begin]);
  useEffect(() => {
    // One absolute opening budget: arrivals and unavailable providers cannot reset it.
    const deadline = setTimeout(() => setRevealed(true), 6000);
    return () => clearTimeout(deadline);
  }, []);
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
    let fontsReady = !document.fonts;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    const assets = new Map<HTMLImageElement, boolean>();
    const check = () => {
      if (!active || !fontsReady || work.current.size || [...assets.values()].some(ready => !ready) ||
        root.current?.querySelector('[data-initial-pending="true"]')) {
        clearTimeout(readyTimer); readyTimer = undefined; return;
      }
      // One quiet commit, without continuously polling the complete DOM.
      readyTimer ??= setTimeout(() => { if (active) setRevealed(true); }, 140);
    };
    notify.current = check;
    const prepareAssets = () => {
      for (const image of root.current?.querySelectorAll("img") ?? []) {
        if (image.closest("[data-defer-preparation]")) continue;
        if (assets.has(image)) continue;
        assets.set(image, false);
        void prepareImage(image, controller.signal).then(() => { assets.set(image, true); check(); });
      }
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === "childList")) prepareAssets();
      check();
    });
    observer.observe(root.current, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-initial-pending"] });
    prepareAssets();
    void document.fonts?.ready.then(() => { fontsReady = true; check(); });
    const fontDeadline = setTimeout(() => { fontsReady = true; check(); }, 1500);
    check();
    return () => {
      active = false; notify.current = () => {}; observer.disconnect(); controller.abort();
      clearTimeout(readyTimer); clearTimeout(fontDeadline);
    };
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
