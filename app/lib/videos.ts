import { videoChannel } from "../data/video-catalog.ts";
export type VideoItem = { id: string; channel: string; title: string; url: string; image: string | null; publishedAt: string | null };
export function validateVideos(raw: unknown): VideoItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap(item => {
    if (!item || typeof item.id !== "string" || typeof item.channel !== "string" || typeof item.title !== "string" || !item.title.trim() || item.title.length > 600) return [];
    const channel = videoChannel(item.channel);
    if (!channel) return [];
    try {
      const url = new URL(item.url), home = new URL(channel.url);
      if (url.protocol !== "https:" || url.username || url.password) return [];
      if (channel.platform === "youtube" ? !/^[\w-]{11}$/.test(item.id) || url.hostname !== "www.youtube.com" || url.pathname !== "/watch" || url.searchParams.get("v") !== item.id : url.hostname !== home.hostname || !/^[\da-f-]{36}$/.test(item.id) || url.pathname !== `/videos/watch/${item.id}`) return [];
      if (seen.has(url.href)) return []; seen.add(url.href);
      let image: string | null = null;
      if (typeof item.image === "string") {
        const photo = new URL(item.image);
        if (photo.protocol === "https:" && !photo.username && !photo.password && (channel.platform === "youtube" ? /(^|\.)ytimg\.com$/.test(photo.hostname) : photo.hostname === home.hostname)) image = photo.href;
      }
      const time = typeof item.publishedAt === "string" ? Date.parse(item.publishedAt) : NaN;
      return [{ id: item.id, channel: item.channel, title: item.title.trim(), url: url.href, image, publishedAt: Number.isFinite(time) ? item.publishedAt : null }];
    } catch { return []; }
  });
}
/** One recent video per channel first; the reading language changes priority, never coverage. */
export function rankVideos(videos: VideoItem[], language: string): VideoItem[] {
  const sorted = [...videos].sort((a,b) => Number(videoChannel(b.channel)?.language === language) - Number(videoChannel(a.channel)?.language === language) || (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0));
  const seen = new Set<string>(); const opening: VideoItem[] = [], remaining: VideoItem[] = [];
  for (const video of sorted) { if (seen.has(video.channel)) remaining.push(video); else { seen.add(video.channel); opening.push(video); } }
  return [...opening, ...remaining];
}
