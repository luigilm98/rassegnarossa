import type { SourceDefinition } from "../data/catalog";

export function preferredLanguageFor(
  languages: readonly string[],
  available: readonly string[],
): string {
  for (const candidate of languages) {
    const language = candidate.toLowerCase().split("-")[0];
    if (available.includes(language)) return language;
  }
  return available.includes("en") ? "en" : (available[0] ?? "all");
}

export function rankSources<
  T extends Pick<SourceDefinition, "language" | "priority" | "kind">,
>(sources: T[], preferred: string): T[] {
  return sources
    .slice()
    .sort(
      (a, b) =>
        Number(b.language === preferred) - Number(a.language === preferred) ||
        Number(a.kind === "radar") - Number(b.kind === "radar") ||
        b.priority - a.priority,
    );
}

export function nextSourcePage<T extends SourceDefinition>(
  sources: T[],
  preferred: string,
  attempted: ReadonlySet<string>,
  size = 16,
): T[] {
  return rankSources(sources, preferred)
    .filter((source) => !attempted.has(source.id))
    .slice(0, size);
}

/** Never substitute Italian recommendations for a different selected language. */
export function recommendedSources(
  sources: SourceDefinition[],
  language: string,
  size = 3,
): SourceDefinition[] {
  const eligible = sources.filter(
    (source) => language === "all" || source.language === language,
  );
  if (language === "it") {
    const ids = ["ottolina", "dazibao", "ottolina-dazibao"];
    return ids
      .map((id) => eligible.find((source) => source.id === id))
      .filter((source): source is SourceDefinition => !!source)
      .slice(0, size);
  }
  const ranked = rankSources(eligible, language);
  const selected: SourceDefinition[] = [];
  const countries = new Set<string>();
  for (const source of ranked) {
    if (countries.has(source.country)) continue;
    selected.push(source);
    countries.add(source.country);
    if (selected.length === size) return selected;
  }
  return [
    ...selected,
    ...ranked.filter((source) => !selected.includes(source)),
  ].slice(0, size);
}
