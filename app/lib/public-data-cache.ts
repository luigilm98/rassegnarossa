/** Cache only public, read-only news endpoints. Account data and translation input never enter this cache. */
const POLICIES: Record<string, readonly string[]> = {
  "/api/articles": ["sourceIds", "limitPerSource"],
  "/api/pulse": ["area"],
  "/api/highlights": ["sourceId"],
};
const FRESH_MS = 120000;
const RETAIN_MS = 600000;
const inFlight = new Map<string, Promise<Response>>();

export function publicDataKey(request: Request): Request | null {
  const url = new URL(request.url);
  const allowed = POLICIES[url.pathname];
  if (request.method !== "GET" || !allowed || url.search.length > 4096) return null;
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) return null;
  if (allowed.some(key => url.searchParams.getAll(key).length > 1)) return null;
  url.hash = "";
  if (url.searchParams.has("sourceIds"))
    url.searchParams.set("sourceIds", [...new Set(url.searchParams.get("sourceIds")!.split(",").map(id => id.trim()).filter(Boolean))].sort().join(","));
  url.searchParams.set("_public_cache", "2");
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
    let task = inFlight.get(key.url);
    if (!task) {
      task = (async () => {
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
      })().finally(() => inFlight.delete(key.url));
      inFlight.set(key.url, task);
    }
    return (await task).clone();
  };
  try {
    const cached = await cache.match(key);
    if (cached) {
      const stamp = Number(cached.headers.get("x-rassegna-cached-at"));
      const age = clock() - stamp;
      if (stamp > 0 && age >= 0 && age < RETAIN_MS) {
        if (age >= FRESH_MS) waitUntil(refresh().catch(() => {}));
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
