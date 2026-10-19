import type { VideoChannel } from "../data/video-catalog.ts";
import { readerText } from "./book-text.ts";
import { validateVideos, type VideoItem } from "./videos.ts";
export function parseVideoFeed(xml: string, channel: VideoChannel): VideoItem[] {
  return validateVideos([...xml.matchAll(/<entry\b[^>]*>([^]*?)<\/entry>/gi)].flatMap(match => {
    const entry = match[1];
    if (entry.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1] !== channel.channelId) return [];
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!id) return [];
    return [{ id, channel: channel.id, title: readerText(entry.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1] ?? ""), url: `https://www.youtube.com/watch?v=${id}`, image: entry.match(/<media:thumbnail\b[^>]*url="([^"]+)"/)?.[1] ?? null, publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null }];
  })).sort((a,b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0)).slice(0,3);
}
export function parsePeerTubeVideos(raw: unknown, channel: VideoChannel): VideoItem[] {
  const items = (raw as { data?: unknown[] })?.data;
  if (!Array.isArray(items)) return [];
  return validateVideos(items.flatMap(raw => {
    const item = raw as { uuid?: string; name?: string; url?: string; thumbnailPath?: string; publishedAt?: string; channel?: { name?: string } };
    if (!item || item.channel?.name !== "chaine_officielle") return [];
    return [{ id: item.uuid, channel: channel.id, title: item.name, url: item.url, image: item.thumbnailPath ? new URL(item.thumbnailPath, channel.url).href : null, publishedAt: item.publishedAt ?? null }];
  })).slice(0,3);
}
