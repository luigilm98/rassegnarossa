import {
  RADAR_ARTICLE_WINDOW,
  RADAR_CHANNEL_COUNT,
  REGION_ORDER,
  SOURCE_CATALOG,
  TOPIC_TAXONOMY,
} from "@/app/data/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const languages = Array.from(
    new Set(SOURCE_CATALOG.map((source) => source.language)),
  ).sort();
  const ideologies = Array.from(
    new Set(SOURCE_CATALOG.flatMap((source) => source.ideologies)),
  ).sort();
  const kinds = Array.from(new Set(SOURCE_CATALOG.map((source) => source.kind))).sort();

  return Response.json({
    generatedAt: new Date().toISOString(),
    sources: SOURCE_CATALOG,
    radarChannelCount: RADAR_CHANNEL_COUNT,
    radarArticleWindow: RADAR_ARTICLE_WINDOW,
    topics: TOPIC_TAXONOMY,
    regions: REGION_ORDER,
    languages,
    ideologies,
    kinds,
  });
}
