"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Play } from "lucide-react";
import { VIDEO_CHANNELS, videoChannel } from "@/app/data/video-catalog";
import SNAPSHOT from "@/app/data/video-snapshot.json" with { type: "json" };
import { rankVideos, validateVideos } from "@/app/lib/videos";
import { LocalizedText as T, useLocale } from "./Localization";
const CACHE_KEY = "rassegna-rossa.video-cache";
const MAX_AGE = 86400000;
export const VideoCarousel = memo(function VideoCarousel() {
  const locale = useLocale();
  const [videos, setVideos] = useState(() => Date.now() - SNAPSHOT.fetchedAt < MAX_AGE ? validateVideos(SNAPSHOT.videos) : []);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });
  const track = useRef<HTMLDivElement>(null);
  const preferred = useRef(locale); preferred.current = locale;
  const ordered = useMemo(() => rankVideos(videos, locale), [videos, locale]);
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
      if (cached?.savedAt > SNAPSHOT.fetchedAt && cached.savedAt > Date.now() - MAX_AGE && cached.savedAt <= Date.now()) {
        const restored = validateVideos(cached.videos); if (restored.length) setVideos(restored);
      }
    } catch { /* Optional public cache. */ }
    const controller = new AbortController(); let active = true, running = false;
    const refresh = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true; setBusy(true); let cursor = 0, failed = 0;
      const channels = [...VIDEO_CHANNELS].sort((a,b) => Number(b.language === preferred.current) - Number(a.language === preferred.current));
      const worker = async () => {
        while (cursor < channels.length && active) {
          const channel = channels[cursor++];
          try {
            const response = await fetch(`/api/videos?channel=${encodeURIComponent(channel.id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
            const data = await response.json();
            if (!response.ok) throw Error("Video source unavailable");
            const clips = validateVideos(data.videos).filter(video => video.channel === channel.id);
            if (data.stale || !clips.length) failed++;
            if (active && clips.length) setVideos(previous => [...previous.filter(video => video.channel !== channel.id), ...clips]);
          } catch { failed++; }
        }
      };
      await Promise.all([worker(), worker()]);
      running = false;
      if (active) { setUnavailable(failed); setBusy(false); }
    };
    const start = setTimeout(() => void refresh(), 600);
    const timer = setInterval(() => void refresh(), 300000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; controller.abort(); clearTimeout(start); clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  useEffect(() => {
    if (!videos.length) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), videos })); } catch { /* Never evict bookmarks for video thumbnails. */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [videos]);
  const measure = useCallback(() => {
    const el = track.current; if (!el) return;
    const next = { start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 };
    setEdges(previous => previous.start === next.start && previous.end === next.end ? previous : next);
  }, []);
  useEffect(() => {
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (track.current) observer?.observe(track.current);
    return () => observer?.disconnect();
  }, [ordered.length, measure]);
  const move = (direction: number) => {
    const el = track.current;
    el?.scrollBy({ left: direction * el.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return <section className="video-carousel" aria-label="Ultimi video dai canali internazionali" data-defer-preparation>
    <div className="video-carousel-heading">
      <div><span className="video-live-dot" aria-hidden="true" /><h2><T>Video dal mondo</T></h2><span className="video-channel-count">{VIDEO_CHANNELS.length} <T>canali</T></span></div>
      <div className="video-carousel-actions"><span className="video-update-status" role="status"><T>{busy ? "In aggiornamento" : "Ultime pubblicazioni"}</T></span><button type="button" aria-label="Video precedenti" onClick={() => move(-1)} disabled={edges.start}><ArrowLeft size={17}/></button><button type="button" aria-label="Video successivi" onClick={() => move(1)} disabled={edges.end}><ArrowRight size={17}/></button></div>
    </div>
    <div className="video-track" dir="ltr" ref={track} onScroll={measure} tabIndex={0} aria-label="Scorri i video">
      {ordered.length ? ordered.map(video => {
        const channel = videoChannel(video.channel)!;
        return <article className="video-card" key={video.id} dir={["ar","fa","he","ur"].includes(locale) ? "rtl" : "ltr"}>
          <a className="video-watch-link" href={video.url} target="_blank" rel="noopener noreferrer">
            <div className="video-thumbnail">
              {video.image ? <img src={video.image} alt="" width={480} height={270} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/> : null}
              <span className="video-play" aria-hidden="true"><Play size={20} fill="currentColor"/></span><span className="video-platform">{channel.platform === "youtube" ? "YouTube" : "PeerTube"}</span>
            </div>
            <h3 dir="auto"><T from={channel.language} defer>{video.title}</T></h3>
          </a>
          <div className="video-card-meta"><a href={channel.url} target="_blank" rel="noopener noreferrer">{channel.name}</a><span><T>{channel.country}</T></span></div>
          {video.publishedAt ? <time dateTime={video.publishedAt}>{new Intl.DateTimeFormat(locale, { day:"numeric", month:"short" }).format(new Date(video.publishedAt))}</time> : <span className="video-date-unknown"><T>Data non fornita dal canale</T></span>}
        </article>;
      }) : VIDEO_CHANNELS.slice(0,6).map(channel => <a className="video-channel-placeholder" key={channel.id} href={channel.url} target="_blank" rel="noopener noreferrer"><Play size={24}/><strong>{channel.name}</strong><span><T>Apri gli ultimi video sul canale</T><ExternalLink size={13}/></span></a>)}
    </div>
    <details className="video-channel-directory"><summary><T>Esplora i canali</T> · YouTube / PeerTube</summary><div>{VIDEO_CHANNELS.map(channel => <a href={channel.url} key={channel.id} target="_blank" rel="noopener noreferrer">{channel.name}<span><T>{channel.country}</T> · {channel.language.toUpperCase()}</span><ExternalLink size={12}/></a>)}</div></details>
    {unavailable ? <p className="video-availability" role="status"><T>Alcuni canali non rispondono: restano disponibili gli ultimi video recuperati e i collegamenti originali.</T></p> : null}
  </section>;
});
