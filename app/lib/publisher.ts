import type { ArticleRecord } from "./feed";
import type { SourceDefinition } from "../data/catalog";

const host = (url: string): string => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};
/** A radar edition is not evidence of the publisher's country or language. */
export function createPublisherResolver(catalog: SourceDefinition[]) {
  const publishers = catalog.filter(source => source.kind !== "radar");
  const ids = new Map(publishers.map(source => [source.id, source]));
  const hosts = new Map<string, SourceDefinition[]>();
  for (const source of publishers) {
    const key = host(source.homepage);
    if (key) hosts.set(key, [...(hosts.get(key) ?? []), source]);
  }
  return (article: Pick<ArticleRecord, "sourceId" | "sourceHomepage" | "country" | "language" | "kind">) => {
    const direct = ids.get(article.sourceId.replace(/^pulse-direct-/, ""));
    const matches = direct ? [direct] : hosts.get(host(article.sourceHomepage)) ?? [];
    const countries = [...new Set(matches.map(source => source.country))];
    const languages = [...new Set(matches.map(source => source.language))];
    return {
      country: countries.length === 1 ? countries[0] : article.kind !== "radar" ? article.country || null : null,
      // Native feed/item metadata is authoritative, including multilingual publishers.
      // Radar language describes the search edition, so known publisher metadata corrects it.
      language: article.kind !== "radar" && article.language
        ? article.language
        : languages.length === 1 ? languages[0] : article.language,
    };
  };
}
