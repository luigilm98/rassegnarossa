/** Cache only public, read-only news endpoints. Account data and translation input never enter this cache. */
const POLICIES: Record<string, readonly string[]> = {
  "/api/articles": ["sourceIds", "limitPerSource", "includeImages"],
  "/api/pulse": ["area"],
  "/api/highlights": ["sourceId"],
  "/api/videos": ["channel"],
};
const FRESH_MS = 120000;
const RETAIN_MS = 600000;
// Background revalidation may be skipped, but no request awaits another invocation's I/O.
const refreshing = new Set<string>();

export function publicDataKey(request: Request): Request | null {
  const url = new URL(request.url);
  const allowed = POLICIES[url.pathname];
  if (request.method !== "GET" || !allowed || url.search.length > 4096) return null;
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) return null;
  if (allowed.some(key => url.searchParams.getAll(key).length > 1)) return null;
  url.hash = "";
  if (url.searchParams.has("sourceIds"))
    url.searchParams.set("sourceIds", [...new Set(url.searchParams.get("sourceIds")!.split(",").map(id => id.trim()).filter(Boolean))].sort().join(","));
  url.searchParams.set("_public_cache", "5");
  url.searchParams.sort();
  return new Request(url, { method: "GET" });
}

export async function publicDataResponse(request: Request, {
  cache, load, waitUntil, clock = Date.now,
}: {
  cache?: Pick<Cache, "match" | "put">;
  load: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  clock?: () => number;
}): Promise<Response> {
  const key = publicDataKey(request);
  if (!key || !cache) return load();
  const refresh = async () => {
    const response = await load();
    const control = response.headers.get("cache-control") ?? "";
    if (response.ok && /\bpublic\b/i.test(control) && !/no-store|private/i.test(control) &&
      !response.headers.has("set-cookie") && !/cookie|authorization|\*/i.test(response.headers.get("vary") ?? "") && /application\/json/i.test(response.headers.get("content-type") ?? "")) {
      const headers = new Headers(response.headers);
      headers.set("cache-control", `public, max-age=${RETAIN_MS / 1000}`);
      headers.set("x-rassegna-cached-at", String(clock()));
      try { await cache.put(key, new Response(response.clone().body, { status: response.status, headers })); }
      catch { /* Cache failure never prevents reading public news. */ }
    }
    return response;
  };
  try {
    const cached = await cache.match(key);
    if (cached) {
      const stamp = Number(cached.headers.get("x-rassegna-cached-at"));
      const age = clock() - stamp;
      if (stamp > 0 && age >= 0 && age < RETAIN_MS) {
        if (age >= FRESH_MS && !refreshing.has(key.url)) {
          refreshing.add(key.url);
          waitUntil(refresh().catch(() => {}).finally(() => refreshing.delete(key.url)));
        }
        const headers = new Headers(cached.headers);
        headers.set("cache-control", "public, max-age=30, stale-while-revalidate=120");
        headers.set("x-rassegna-cache", age < FRESH_MS ? "hit" : "stale");
        headers.set("age", String(Math.floor(age / 1000)));
        return new Response(cached.body, { status: cached.status, headers });
      }
    }
  } catch { /* Fall through to the original endpoint. */ }
  return refresh();
}
