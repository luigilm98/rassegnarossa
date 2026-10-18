/** Minimal D1 interface keeps public cache storage testable without a Worker runtime. */
type NewsDatabase = {
  prepare(sql: string): { bind(...values: unknown[]): {
    first<T>(): Promise<T | null>; run(): Promise<unknown>;
  } };
};
const AREAS = new Set(["europe", "north", "latin", "africa", "asia", "east", "mena", "pacific"]);

export function createPublicNewsStore(db: NewsDatabase | undefined, sourceIds: ReadonlySet<string>, clock = Date.now): Pick<Cache, "match" | "put"> | undefined {
  if (!db) return undefined;
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
      await db.prepare("INSERT INTO public_news_cache (cache_key, body, headers, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET body=excluded.body, headers=excluded.headers, expires_at=excluded.expires_at")
        .bind(key, body, JSON.stringify([...response.headers]), clock() + 600000).run();
    },
  };
}
