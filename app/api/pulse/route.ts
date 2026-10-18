import { SOURCE_CATALOG, type SourceDefinition } from "@/app/data/catalog";
import { fetchSource } from "@/app/lib/feed";
import { SIX_HOURS_MS } from "@/app/lib/pulse";
export const dynamic = "force-dynamic";
// Fixed destinations only: visitors cannot supply proxy URLs.
const AREAS: Record<string, string> = {
  europe: "radar-uk-labor",
  north: "radar-us-labor",
  latin: "radar-br-labor",
  africa: "radar-za-labor",
  asia: "radar-in-labor",
  pacific: "green-left",
  east: "radar-cn-labor",
  mena: "radar-eg-labor",
};
const PUBLISHERS: Record<string, string> = {
  europe: "morning-star",
  north: "truthout",
  latin: "prensa-latina",
  africa: "roape",
  asia: "vietnam-news",
  east: "china-daily",
  mena: "peoples-dispatch",
};
export async function GET(request: Request) {
  const area = new URL(request.url).searchParams.get("area") ?? "europe";
  const original = SOURCE_CATALOG.find((source) => source.id === AREAS[area]);
  if (!original?.feedUrls?.[0])
    return Response.json({ error: "Unknown area" }, { status: 400 });
  const feed = new URL(original.feedUrls[0]);
  // A broad political/world-news sample rather than only the original labor query.
  const matching = SOURCE_CATALOG.filter(
    (source) =>
      source.id.startsWith(original.id.replace(/-labor$/, "-")) &&
      source.feedUrls?.[0],
  );
  const terms = matching
    .filter((source) =>
      /-(labor|antiimperialism|socialistStates)$/.test(source.id),
    )
    .map((source) =>
      new URL(source.feedUrls![0]).searchParams
        .get("q")!
        .replace(/ when:\S+/g, ""),
    );
  if (original.kind === "radar")
    feed.searchParams.set("q", `(${terms.join(" OR ")}) when:6h`);
  const source: SourceDefinition = {
    ...original,
    id: `pulse-${area}`,
    name:
      original.kind === "radar"
        ? `Osservatorio · ${original.country}`
        : original.name,
    feedUrls: [feed.href],
  };
  const publisher = SOURCE_CATALOG.find((item) => item.id === PUBLISHERS[area]);
  const results = await Promise.all([
    fetchSource(source, 60),
    ...(publisher
      ? [fetchSource({ ...publisher, id: `pulse-direct-${publisher.id}` }, 60)]
      : []),
  ]);
  const seen = new Set<string>();
  const collected = results
    .flatMap((result) => result.articles)
    .filter((article) => {
      if (seen.has(article.link)) return false;
      seen.add(article.link);
      return true;
    });
  const now = Date.now();
  const articles = collected.filter((article) => {
    const time = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
    return time >= now - SIX_HOURS_MS && time <= now;
  });
  return Response.json(
    {
      area,
      region: source.region,
      generatedAt: new Date(now).toISOString(),
      windowStart: new Date(now - SIX_HOURS_MS).toISOString(),
      articles,
      ok: results.some((result) => result.status.ok),
      feeds: results.map((result) => ({
        name: result.source.name,
        ok: result.status.ok,
        stale: result.status.stale ?? false,
      })),
      error: results.some((result) => result.status.ok)
        ? null
        : "Area momentaneamente non disponibile",
    },
    {
      headers: {
        "cache-control": results.some((result) => result.status.ok)
          ? "public, max-age=120"
          : "no-store",
      },
    },
  );
}
