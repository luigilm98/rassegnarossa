import { SOURCE_CATALOG } from "@/app/data/catalog";
import { fetchSource } from "@/app/lib/feed";
import { fetchPublisherPage } from "@/app/lib/publisher-page";
import { applySourceImages } from "@/app/lib/source-highlights";
import { articleImages } from "@/app/lib/article-images";
import { articleMetadataImages, fetchPublicPhotoResource, publicPhotoUrl, readLimited } from "@/app/lib/article-photo";
export const dynamic = "force-dynamic";
const cache = new Map<string, { until: number; bytes: Uint8Array; type: string }>();
const pending = new Map<string, Promise<Response>>();
let cacheBytes = 0;
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
}
function release() { const next = waiting.shift(); if (next) next(); else active--; }
const fail = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });
const responseFor = (entry: { bytes: Uint8Array; type: string }) => new Response(entry.bytes as unknown as BodyInit, { headers: {
  "content-type": entry.type, "cache-control": "public, max-age=600", "x-content-type-options": "nosniff",
} });
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const source = SOURCE_CATALOG.find(item => item.id === params.get("sourceId") && item.kind !== "radar");
  const id = params.get("articleId");
  if (!source || !id || id.length > 150 || params.getAll("sourceId").length !== 1 || params.getAll("articleId").length !== 1 || [...params.keys()].some(key => !["sourceId", "articleId"].includes(key))) return fail(400);
  const key = `${source.id}:${id}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return responseFor(cached);
  const existing = pending.get(key); if (existing) return (await existing).clone();
  if (waiting.length >= 32) return fail(429);
  const task = (async () => {
    await acquire();
    try {
    const result = await fetchSource(source, 24);
    const article = result.articles.find(item => item.id === id);
    if (!article) return fail(404);
    const signal = AbortSignal.timeout(12000);
    const page = await fetchPublisherPage(source);
    const enriched = applySourceImages([article], page.images)[0];
    const headers = { "user-agent": "Mozilla/5.0 RassegnaRossa/1.0", referer: source.homepage, accept: "image/avif,image/webp,image/*" };
    const download = async (urls: string[]) => {
      for (const raw of urls) {
        const url = publicPhotoUrl(raw); if (!url) continue;
        try {
          const response = await fetchPublicPhotoResource(url, signal, headers);
          const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
          if (!response.ok || !/^image\/(?:jpeg|png|webp|avif|gif)$/i.test(type)) { await response.body?.cancel(); continue; }
          const bytes = await readLimited(response, 4_000_000);
          if (!bytes.length) continue;
          while (cache.size && (cacheBytes + bytes.length > 8_000_000 || cache.size >= 64)) {
            const oldest = cache.keys().next().value!; cacheBytes -= cache.get(oldest)!.bytes.length; cache.delete(oldest);
          }
          const previous = cache.get(key); if (previous) cacheBytes -= previous.bytes.length;
          const entry = { until: Date.now() + 600000, bytes, type }; cache.set(key, entry); cacheBytes += bytes.length;
          return responseFor(entry);
        } catch { /* Try only the publisher's verified alternatives. */ }
      }
      return null;
    };
    const known = await download(articleImages(enriched.image, enriched.imageFallbacks));
    if (known) return known;
    const link = publicPhotoUrl(article.link), homeHost = new URL(source.homepage).hostname.replace(/^www\./, "");
    if (link && link.hostname.replace(/^www\./, "") === homeHost && link.pathname !== "/") {
      try {
        const pageResponse = await fetchPublicPhotoResource(link, signal, { ...headers, accept: "text/html" }, fetch, homeHost);
        if (pageResponse.ok && pageResponse.headers.get("content-type")?.includes("text/html")) {
          const html = new TextDecoder().decode(await readLimited(pageResponse, 300000, true));
          const recovered = await download(articleMetadataImages(html, article.link));
          if (recovered) return recovered;
        } else await pageResponse.body?.cancel();
      } catch { /* No invented covers when a source does not publish an accessible image. */ }
    }
    return fail(404);
    } finally { release(); }
  })().catch(() => fail(502)).finally(() => pending.delete(key));
  pending.set(key, task);
  return (await task).clone();
}
