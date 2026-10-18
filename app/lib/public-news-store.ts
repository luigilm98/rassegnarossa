import type { ArticleRecord } from "./feed";
/** Server-observed public references survive feed rotation; no visitor URL enters this store. */
export type PhotoArticle = Pick<ArticleRecord, "id" | "sourceId" | "link" | "image" | "imageFallbacks">;
export type PhotoDatabase = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } } };
const RETAIN = 7 * 86400000;
export function createArticlePhotoStore(db: PhotoDatabase | undefined, sources: ReadonlySet<string>, clock = Date.now) {
  const read = async (sourceId: string): Promise<PhotoArticle[]> => {
    if (!db || !sources.has(sourceId)) return [];
    const row = await db.prepare("SELECT body FROM public_news_cache WHERE cache_key = ? AND expires_at > ?").bind(`photo-references-v1:${sourceId}`, clock()).first<{ body: string }>();
    try { return row ? JSON.parse(row.body) : []; } catch { return []; }
  };
  return {
    async find(sourceId: string, id: string) { return (await read(sourceId)).find(article => article.id === id); },
    async remember(sourceId: string, articles: PhotoArticle[]) {
      if (!db || !sources.has(sourceId)) return;
      const current = articles.filter(article => article.sourceId === sourceId).map(({ id, sourceId, link, image, imageFallbacks }) => ({ id, sourceId, link, image, imageFallbacks }));
      if (!current.length) return;
      const seen = new Set(current.map(article => article.id));
      const merged = [...current, ...(await read(sourceId)).filter(article => !seen.has(article.id))].slice(0, 160);
      await db.prepare("INSERT INTO public_news_cache (cache_key, body, headers, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET body=excluded.body, headers=excluded.headers, expires_at=excluded.expires_at")
        .bind(`photo-references-v1:${sourceId}`, JSON.stringify(merged), "[]", clock() + RETAIN).run();
    },
  };
}

/** Minimal D1 interface keeps public cache storage testable without a Worker runtime. */
type NewsDatabase = {
  prepare(sql: string): { bind(...values: unknown[]): {
    first<T>(): Promise<T | null>; run(): Promise<unknown>;
  } };
};
const AREAS = new Set(["europe", "north", "latin", "africa", "asia", "east", "mena", "pacific"]);

export function createPublicNewsStore(db: NewsDatabase | undefined, sourceIds: ReadonlySet<string>, clock = Date.now): Pick<Cache, "match" | "put"> | undefined {
  if (!db) return undefined;
  const photos = createArticlePhotoStore(db, sourceIds, clock);
  const keyFor = (request: RequestInfo | URL): string | null => {
    const url = new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
    // Fixed finite keys only: arbitrary combinations/limits must not grow persistent storage.
    if (url.pathname === "/api/articles") {
      if (!sourceIds.has(url.searchParams.get("sourceIds") ?? "") || url.searchParams.get("limitPerSource") !== "24") return null;
    } else if (url.pathname === "/api/pulse") {
      if (!AREAS.has(url.searchParams.get("area") ?? "europe")) return null;
    } else if (url.pathname === "/api/highlights") {
      if (!sourceIds.has(url.searchParams.get("sourceId") ?? "")) return null;
    } else return null;
    const allowed = url.pathname === "/api/articles" ? ["sourceIds", "limitPerSource", "includeImages", "_public_cache"] : url.pathname === "/api/pulse" ? ["area", "_public_cache"] : ["sourceId", "_public_cache"];
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) return null;
    if (allowed.some(key => url.searchParams.getAll(key).length > 1)) return null;
    // Host, cookies and identity are deliberately absent: content is public for the whole site.
    const canonical = new URL(url.pathname, "https://public.invalid");
    if (url.pathname === "/api/articles") {
      canonical.searchParams.set("sourceIds", url.searchParams.get("sourceIds")!);
      canonical.searchParams.set("limitPerSource", "24");
      if (url.searchParams.get("includeImages") === "1") canonical.searchParams.set("includeImages", "1");
    } else if (url.pathname === "/api/pulse") canonical.searchParams.set("area", url.searchParams.get("area") ?? "europe");
    else canonical.searchParams.set("sourceId", url.searchParams.get("sourceId")!);
    return "images-v4:" + canonical.pathname + canonical.search;
  };
  return {
    async match(request) {
      const key = keyFor(request);
      if (!key) return undefined;
      const row = await db.prepare("SELECT body, headers FROM public_news_cache WHERE cache_key = ? AND expires_at > ?").bind(key, clock()).first<{ body: string; headers: string }>();
      if (!row) return undefined;
      try { return new Response(row.body, { headers: JSON.parse(row.headers) }); }
      catch { return undefined; }
    },
    async put(request, response) {
      const key = keyFor(request);
      if (!key) return;
      const body = await response.text();
      if (new TextEncoder().encode(body).length > 512000) return;
      const url = new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
      if (url.pathname === "/api/articles") {
        try { await photos.remember(url.searchParams.get("sourceIds")!, JSON.parse(body).articles ?? []); } catch { /* News remains available if reference storage fails. */ }
      }
      await db.prepare("INSERT INTO public_news_cache (cache_key, body, headers, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET body=excluded.body, headers=excluded.headers, expires_at=excluded.expires_at")
        .bind(key, body, JSON.stringify([...response.headers]), clock() + 600000).run();
    },
  };
}
