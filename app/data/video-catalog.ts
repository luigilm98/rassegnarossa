import CHANNELS from "./video-channels.json" with { type: "json" };
export type VideoChannel = {
  id: string; name: string; language: string; country: string;
  platform: "youtube" | "peertube"; url: string; channelId?: string; apiUrl?: string;
};
export const VIDEO_CHANNELS: VideoChannel[] = CHANNELS as VideoChannel[];
export const videoChannel = (id: string) => VIDEO_CHANNELS.find(channel => channel.id === id);
