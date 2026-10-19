import { resolveRadarLink, resolvePublisherHeadline } from "@/app/lib/radar-link";
import type { PhotoArticle } from "@/app/lib/public-news-store";
import { SOURCE_CATALOG } from "@/app/data/catalog";
import { fetchSource } from "@/app/lib/feed";
import { fetchPublisherPage } from "@/app/lib/publisher-page";
import { applySourceImages } from "@/app/lib/source-highlights";
import { articleImages } from "@/app/lib/article-images";
import { articleMetadataImages, fetchPublicPhotoResource, publicPhotoUrl, readLimited } from "@/app/lib/article-photo";
export const dynamic = "force-dynamic";
const cache = new Map<string, { until: number; bytes: Uint8Array; type: string }>();
let cacheBytes = 0;
let active = 0;
const fail = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });
const responseFor = (entry: { bytes: Uint8Array; type: string }) => new Response(entry.bytes as unknown as BodyInit, { headers: {
  "content-type": entry.type, "cache-control": "public, max-age=600", "x-content-type-options": "nosniff",
} });
export async function GET(request: Request, find?: (sourceId: string, id: string) => Promise<PhotoArticle | undefined>): Promise<Response> {
  const params = new URL(request.url).searchParams;
  let source = SOURCE_CATALOG.find(item => item.id === params.get("sourceId"));
  if (!source && /^radar:[a-z0-9]+$/i.test(params.get("sourceId") ?? "")) source = { id: params.get("sourceId")!, homepage: "https://news.google.com/", kind: "radar" } as typeof SOURCE_CATALOG[number];
  const id = params.get("articleId");
  if (!source || !id || id.length > 150 || params.getAll("sourceId").length !== 1 || params.getAll("articleId").length !== 1 || [...params.keys()].some(key => !["sourceId", "articleId", "articleLink"].includes(key))) return fail(400);
  const rawLink = params.get("articleLink");
  const suppliedLink = rawLink ? publicPhotoUrl(rawLink) : null;
  const publisherHost = new URL(source.homepage).hostname.replace(/^www\./, "");
  // Legacy/local cards may predate the retained feed. Limit their page lookup to this configured publisher.
  if (params.getAll("articleLink").length > 1 || (rawLink !== null && (!suppliedLink || rawLink.length > 2048 || suppliedLink.pathname === "/"))) return fail(400);
  const stored = await find?.(source.id, id).catch(() => undefined);
  // Regional editions can use another host. Only a matching server-observed record
  // may authorize that host; a client-supplied URL never expands the allowlist.
  if (source.kind !== "radar" && suppliedLink && suppliedLink.hostname.replace(/^www\./, "") !== publisherHost && suppliedLink.href !== stored?.link) return fail(400);
  const selectedSource = source;
  const key = `${source.id}:${id}:${suppliedLink?.href ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return responseFor(cached);
  // A request must never await a resolver owned by a different Worker invocation.
  if (active >= 12) return new Response(null, { status: 503, headers: { "cache-control": "no-store", "retry-after": "1" } });
  const task = (async () => {
    active++;
    try {
    let source = selectedSource;
    // Resolve the exact reference already delivered to readers before consulting a rotating feed.
    let article = source.kind === "radar" ? stored : stored ?? (suppliedLink ? { id, sourceId: source.id, link: suppliedLink.href, image: null } :
      (await fetchSource(source, 24)).articles.find(item => item.id === id));
    if (!article) return fail(404);
    if (source.kind !== "radar" && stored) {
      const observed = publicPhotoUrl(stored.link);
      if (observed) source = { ...source, homepage: observed.origin + "/" };
    }
    const signal = AbortSignal.timeout(source.kind === "radar" ? 20000 : 12000);
    if (source.kind === "radar") {
      if (!stored?.sourceHomepage || (suppliedLink && suppliedLink.href !== stored.link)) return fail(400);
      const original = await resolveRadarLink(stored.link, stored.sourceHomepage, signal) ?? await resolvePublisherHeadline(stored.title ?? "", stored.sourceHomepage, signal);
      if (!original) return fail(404);
      article = { ...stored, link: original };
      source = { ...source, homepage: new URL(original).origin + "/" };
    }
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
    const originalUrls = articleImages(article.image, "imageFallbacks" in article ? article.imageFallbacks : undefined);
    const known = await download(originalUrls);
    if (known) return known;
    const page = await fetchPublisherPage(source, false);
    const enriched = applySourceImages([article as import("@/app/lib/feed").ArticleRecord], page.images)[0];
    const homepagePhoto = await download(articleImages(enriched.image, enriched.imageFallbacks).filter(url => !originalUrls.includes(url)));
    if (homepagePhoto) return homepagePhoto;
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
    } finally { active--; }
  })().catch(() => fail(502));
  return (await task).clone();
}
