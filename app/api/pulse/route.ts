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
  const result = await fetchSource(source, 60);
  const now = Date.now();
  const articles = result.articles.filter((article) => {
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
      ok: result.status.ok,
      error: result.status.ok ? null : "Area momentaneamente non disponibile",
    },
    {
      headers: {
        "cache-control": result.status.ok ? "public, max-age=120" : "no-store",
      },
    },
  );
}
