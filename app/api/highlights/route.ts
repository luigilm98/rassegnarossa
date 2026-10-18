import { SOURCE_CATALOG } from "@/app/data/catalog";
import { parseSourcePage, type SourceHighlight, type SourceImage } from "@/app/lib/source-highlights";
export const dynamic = "force-dynamic";
const cache = new Map<string, { until: number; highlights: SourceHighlight[]; images: SourceImage[]; ok: boolean }>();
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("sourceId");
  const source = SOURCE_CATALOG.find(item => item.id === id && item.kind !== "radar" && !/youtube\.com/.test(item.homepage));
  if (!source) return Response.json({ error: "Unknown publisher" }, { status: 400 });
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
  return Response.json({ sourceId: source.id, highlights: value.highlights, images: value.images, ok: value.ok, observedAt: new Date(value.until - (value.ok ? 600_000 : 60_000)).toISOString() }, { headers: { "cache-control": value.ok ? "public, max-age=120" : "no-store" } });
}
