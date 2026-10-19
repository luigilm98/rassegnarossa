import { videoChannel } from "@/app/data/video-catalog";
import SNAPSHOT from "@/app/data/video-snapshot.json" with { type: "json" };
import { parseVideoFeed, parsePeerTubeVideos } from "@/app/lib/video-parser";
import { validateVideos, type VideoItem } from "@/app/lib/videos";
import { parseYouTubeListing } from "@/app/lib/youtube";
import { fetchPublicPhotoResource, readLimited } from "@/app/lib/article-photo";
import { createBoundedCache } from "@/app/lib/bounded-cache";
export const dynamic = "force-dynamic";
const cache = createBoundedCache<string, { until: number; videos: VideoItem[] }>(32, 500000, value => JSON.stringify(value).length * 2);
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const channel = videoChannel(params.get("channel") ?? "");
  if (!channel || params.getAll("channel").length !== 1 || [...params.keys()].some(key => key !== "channel")) return Response.json({ error: "Unknown channel" }, { status: 400 });
  const reply = (videos: VideoItem[], stale = false) => Response.json({ channel: channel.id, videos, stale, fetchedAt: Date.now() }, { headers: { "cache-control": videos.length ? "public, max-age=120" : "no-store" } });
  const old = cache.get(channel.id);
  if (old && old.until > Date.now()) return reply(old.videos);
  const signal = AbortSignal.timeout(9000);
  const load = async (url: string, limit: number) => {
    const target = new URL(url);
    const response = await fetchPublicPhotoResource(target, signal, { accept: "application/atom+xml, application/json, text/html", "user-agent": "RassegnaRossa/1.0 (public video channels)" }, fetch, target.hostname.replace(/^www\./,""));
    if (!response.ok) { await response.body?.cancel(); throw Error("Channel unavailable"); }
    return new TextDecoder().decode(await readLimited(response, limit));
  };
  try {
    let videos: VideoItem[] = [];
    if (channel.platform === "peertube") videos = parsePeerTubeVideos(JSON.parse(await load(channel.apiUrl!, 500000)), channel);
    else {
      try { videos = parseVideoFeed(await load(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`, 500000), channel); } catch { /* Try the channel's actual video tab. */ }
      if (!videos.length && !signal.aborted) videos = validateVideos(parseYouTubeListing(await load(channel.url + "/videos", 2500000)).slice(0,3).map(video => ({ id: video.videoId, channel: channel.id, title: video.title, url: `https://www.youtube.com/watch?v=${video.videoId}`, image: video.image, publishedAt: null })));
    }
    if (!videos.length) throw Error("No readable videos");
    cache.set(channel.id, { until: Date.now() + 300000, videos });
    return reply(videos);
  } catch {
    const fallback = old?.videos ?? (Date.now() - SNAPSHOT.fetchedAt < 86400000 ? validateVideos(SNAPSHOT.videos).filter(video => video.channel === channel.id) : []);
    return reply(fallback, true);
  }
}
