import { SOURCE_CATALOG } from "@/app/data/catalog";
import {
  fetchSource,
  getSources,
  type SourceFetchResult,
} from "@/app/lib/feed";

import { fetchPublisherPage } from "@/app/lib/publisher-page";
import { applySourceImages } from "@/app/lib/source-highlights";

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
  const withImages = url.searchParams.get("includeImages") === "1";
  const fetched = await promisePool(sources, 6, async source => {
    // Prepare both in parallel: photo metadata belongs to the article response, not a later browser queue.
    const page = withImages && source.kind !== "radar" && !/youtube\.com/.test(source.homepage)
      ? fetchPublisherPage(source) : null;
    const result = await fetchSource(source, limitPerSource);
    if (!result.articles.length) return result;
    const metadata = await page;
    return metadata?.images.length ? { ...result, articles: applySourceImages(result.articles, metadata.images) } : result;
  });
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
