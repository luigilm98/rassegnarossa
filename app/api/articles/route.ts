import { SOURCE_CATALOG } from "@/app/data/catalog";
import {
  fetchSource,
  getSources,
  type SourceFetchResult,
} from "@/app/lib/feed";

export const dynamic = "force-dynamic";

const MAX_SOURCES_PER_REQUEST = 14;
const DEFAULT_LIMIT_PER_SOURCE = 50;
const MAX_ARTICLES_PER_RESPONSE = 2500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = splitParam(url.searchParams.get("sourceIds"));
  const limitPerSource = clampNumber(
    Number(url.searchParams.get("limitPerSource") ?? DEFAULT_LIMIT_PER_SOURCE),
    1,
    250,
    DEFAULT_LIMIT_PER_SOURCE,
  );
  const sources = getSources(ids).slice(0, MAX_SOURCES_PER_REQUEST);
  const cacheUrl = new URL(request.url);
  cacheUrl.search = "";
  cacheUrl.searchParams.set("v", "2");
  cacheUrl.searchParams.set(
    "sourceIds",
    sources
      .map((source) => source.id)
      .sort()
      .join(","),
  );
  cacheUrl.searchParams.set("limitPerSource", String(limitPerSource));
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const edgeCache =
    typeof caches === "undefined"
      ? undefined
      : (caches as CacheStorage & { default?: Cache }).default;
  try {
    const cached = await edgeCache?.match(cacheKey);
    if (cached) return cached;
  } catch {
    /* Caching is optional; publisher errors must remain readable. */
  }
  const fetched = await promisePool(sources, 6, (source) =>
    fetchSource(source, limitPerSource),
  );
  const results = fetched.filter(
    (result): result is SourceFetchResult => result !== null,
  );
  const articles = dedupeByLink(results.flatMap((result) => result.articles))
    .sort((a, b) => {
      const left = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const right = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return right - left || b.score - a.score;
    })
    .slice(0, MAX_ARTICLES_PER_RESPONSE);

  const response = Response.json(
    {
      generatedAt: new Date().toISOString(),
      sourceCount: sources.length,
      totalCatalogSources: SOURCE_CATALOG.length,
      articles,
      statuses: results.map((result) => result.status),
    },
    {
      headers: {
        "cache-control": results.some((result) => result.status.ok)
          ? "public, max-age=120"
          : "no-store",
      },
    },
  );
  if (results.some((result) => result.status.ok)) {
    try {
      await edgeCache?.put(cacheKey, response.clone());
    } catch {
      /* A cache miss must not fail the request. */
    }
  }
  return response;
}

function splitParam(value: string | null) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

async function promisePool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

function dedupeByLink<T extends { link: string; title: string }>(
  articles: T[],
) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = article.link || article.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
