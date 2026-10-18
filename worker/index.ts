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

interface Env {
  ASSETS: Fetcher;
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
  "/api/article-image": articleImageEndpoint, "/api/articles": articlesEndpoint, "/api/pulse": pulseEndpoint, "/api/highlights": highlightsEndpoint,
};
const sourceIds = new Set(SOURCE_CATALOG.map(source => source.id));

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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
