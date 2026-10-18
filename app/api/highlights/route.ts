import { SOURCE_CATALOG } from "@/app/data/catalog";
import { fetchPublisherPage } from "@/app/lib/publisher-page";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("sourceId");
  const source = SOURCE_CATALOG.find(item => item.id === id && item.kind !== "radar" && !/youtube\.com/.test(item.homepage));
  if (!source) return Response.json({ error: "Unknown publisher" }, { status: 400 });
  const value = await fetchPublisherPage(source);
  return Response.json({ sourceId: source.id, highlights: value.highlights, images: value.images, ok: value.ok, observedAt: new Date(value.until - (value.ok ? 600_000 : 60_000)).toISOString() }, { headers: { "cache-control": value.ok ? "public, max-age=120" : "no-store" } });
}
