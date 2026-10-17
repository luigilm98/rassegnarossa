export type ChannelVideo = {
  videoId: string;
  title: string;
  image: string | null;
};

/** Read only the selected channel tab, never recommendations or executable scripts. */
export function parseYouTubeListing(html: string): ChannelVideo[] {
  try {
    const match = html.match(
      /(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*(\{[\s\S]*?\});/,
    );
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
    if (!Array.isArray(tabs)) return [];
    const selected = tabs.find((tab) => tab?.tabRenderer?.selected)?.tabRenderer
      ?.content;
    if (!selected) return [];
    const videos = new Map<string, ChannelVideo>();
    let nodes = 0;
    const walk = (value: unknown) => {
      if (
        ++nodes > 20000 ||
        videos.size >= 30 ||
        !value ||
        typeof value !== "object"
      )
        return;
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry);
        return;
      }
      const object = value as Record<string, any>;
      const modern = object.lockupViewModel;
      const classic = object.videoRenderer;
      if (modern || classic) {
        const videoId = modern?.contentId ?? classic?.videoId;
        const title =
          modern?.metadata?.lockupMetadataViewModel?.title?.content ??
          classic?.title?.simpleText ??
          classic?.title?.runs
            ?.map((run: { text?: string }) => run.text ?? "")
            .join("");
        if (
          typeof videoId !== "string" ||
          !/^[A-Za-z0-9_-]{11}$/.test(videoId) ||
          typeof title !== "string" ||
          !title.trim()
        )
          return;
        const rawImage =
          modern?.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url ??
          classic?.thumbnail?.thumbnails?.[0]?.url;
        let image: string | null = null;
        if (typeof rawImage === "string") {
          try {
            const url = new URL(rawImage);
            if (
              url.protocol === "https:" &&
              /(^|\.)ytimg\.com$/.test(url.hostname)
            )
              image = url.href;
          } catch {}
        }
        videos.set(videoId, { videoId, title: title.trim(), image });
        return;
      }
      for (const nested of Object.values(object)) walk(nested);
    };
    walk(selected);
    return Array.from(videos.values());
  } catch {
    return [];
  }
}
