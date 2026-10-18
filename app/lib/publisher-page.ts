import type { SourceDefinition } from "../data/catalog";
import { parseSourcePage, type SourceHighlight, type SourceImage } from "./source-highlights";
const cache = new Map<string, { until: number; highlights: SourceHighlight[]; images: SourceImage[]; ok: boolean }>();
const pending = new Map<string, Promise<PublisherPage>>();
export type PublisherPage = { until: number; highlights: SourceHighlight[]; images: SourceImage[]; ok: boolean };
export function fetchPublisherPage(source: Pick<SourceDefinition, "homepage">): Promise<PublisherPage> {
  const existing = pending.get(source.homepage);
  if (existing) return existing;
  const task = loadPublisherPage(source).finally(() => pending.delete(source.homepage));
  pending.set(source.homepage, task);
  return task;
}
async function loadPublisherPage(source: Pick<SourceDefinition, "homepage">): Promise<PublisherPage> {
  const key = source.homepage;
  let value = cache.get(key);
  if (!value || value.until <= Date.now()) {
    try {
      const response = await fetch(source.homepage, {
        headers: { accept: "text/html", "user-agent": "RassegnaRossa/1.0 (public source highlights)" },
        signal: AbortSignal.timeout(4500), redirect: "follow",
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Publisher unavailable");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty response");
      let bytes = 0, html = "";
      const decoder = new TextDecoder();
      try {
        while (bytes < 1_200_000) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = value.subarray(0, 1_200_000 - bytes);
          bytes += chunk.length; html += decoder.decode(chunk, { stream: true });
        }
        html += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); }
      value = { until: Date.now() + 600_000, ...parseSourcePage(html, source.homepage), ok: true };
    } catch { value = { until: Date.now() + 60_000, highlights: [], images: [], ok: false }; }
    cache.set(key, value);
  }
  return value;
}
