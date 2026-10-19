import { handleCommunity } from "../app/lib/community";
import { handleReadingProgress } from "../app/lib/reading-progress";
import { readBook } from "../app/lib/book-reader";
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { GET as articleImageEndpoint } from "../app/api/article-image/route";
import { GET as articlesEndpoint } from "../app/api/articles/route";
import { GET as pulseEndpoint } from "../app/api/pulse/route";
import { GET as highlightsEndpoint } from "../app/api/highlights/route";
import { SOURCE_CATALOG } from "../app/data/catalog";
import { createArticlePhotoStore } from "../app/lib/public-news-store";
import { createPublicNewsStore } from "../app/lib/public-news-store";
import { publicDataResponse } from "../app/lib/public-data-cache";
import { handleBookmarks } from "../app/lib/bookmarks";
import { chatGPTUserFromHeaders, chatGPTSignInPath } from "../app/chatgpt-auth";
import { THEORY_LIBRARY } from "../app/data/library";
import type { D1Database } from "@cloudflare/workers-types/index.ts";
import { GET as videosEndpoint } from "../app/api/videos/route";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const publicEndpoints: Record<string, (request: Request) => Promise<Response>> = {
  "/api/videos": videosEndpoint,
  "/api/article-image": articleImageEndpoint, "/api/articles": articlesEndpoint, "/api/pulse": pulseEndpoint, "/api/highlights": highlightsEndpoint,
};
const sourceIds = new Set(SOURCE_CATALOG.map(source => source.id));

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/community" || url.pathname === "/api/community/mine")
      return handleCommunity(request, env.DB, chatGPTUserFromHeaders(request.headers)?.id ?? null, chatGPTSignInPath("/?view=partecipa"));

    if (url.pathname === "/api/reading-progress" || url.pathname === "/api/library/read") {
      const userId = chatGPTUserFromHeaders(request.headers)?.id ?? null;
      const bookId = url.searchParams.get("bookId") ?? "", edition = url.searchParams.get("edition") ?? "";
      const signInUrl = chatGPTSignInPath(`/read?${new URLSearchParams({ book: bookId, edition })}`);
      if (url.pathname === "/api/reading-progress") return handleReadingProgress(request, env.DB, userId, signInUrl);
      const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "private, no-store", vary: "cookie" } });
      if (!userId) return reply({ authenticated: false, signInUrl }, 401);
      if (request.method !== "GET") return reply({ error: "Method not allowed" }, 405);
      if ([...url.searchParams.keys()].some(key => !["bookId", "edition", "chapter"].includes(key)) || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length > 1)) return reply({ error: "Invalid request" }, 400);
      if (!THEORY_LIBRARY.some(book => book.id === bookId && book.editions?.some(item => item.language === edition))) return reply({ error: "Unknown edition" }, 400);
      const chapter = Number(url.searchParams.get("chapter") ?? 0);
      if (!Number.isSafeInteger(chapter) || chapter < 0 || chapter > 255) return reply({ error: "Invalid chapter" }, 400);
      try { return reply(await readBook(bookId, edition, chapter)); }
      catch (error) { return reply({ error: error instanceof RangeError ? "Capitolo non disponibile" : "Non è stato possibile aprire questa edizione. Puoi riprovare o consultare l’archivio originale." }, error instanceof RangeError ? 400 : 503); }
    }

    if (url.pathname === "/api/bookmarks")
      return handleBookmarks(request, env.DB, chatGPTUserFromHeaders(request.headers)?.id ?? null, new Set(THEORY_LIBRARY.map(book => book.id)), chatGPTSignInPath("/?view=salvati"));

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (request.method === "GET" && url.pathname === "/api/article-image")
      return articleImageEndpoint(request, (sourceId, id) => createArticlePhotoStore(env.DB, sourceIds).find(sourceId, id));

    const endpoint = request.method === "GET" ? publicEndpoints[url.pathname] : undefined;
    if (endpoint) return publicDataResponse(request, {
      cache: createPublicNewsStore(env.DB, sourceIds)
        ?? (typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default),
      load: () => endpoint(request),
      waitUntil: promise => ctx.waitUntil(promise),
    });
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
