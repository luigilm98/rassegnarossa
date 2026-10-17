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
