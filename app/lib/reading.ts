import type { ArticleRecord } from "./feed";

export type ReadingArticle = ArticleRecord;

export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function validateArticles(value: unknown): ReadingArticle[] {
  try {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ReadingArticle => {
      if (!item || typeof item !== "object") return false;
      return (
        [
          "id",
          "title",
          "sourceId",
          "sourceName",
          "sourceHomepage",
          "country",
          "language",
          "region",
          "kind",
          "excerpt",
        ].every((key) => typeof item[key] === "string") &&
        ["topics", "categories", "ideologies"].every(
          (key) =>
            Array.isArray(item[key]) &&
            item[key].every((entry: unknown) => typeof entry === "string"),
        ) &&
        typeof item.score === "number" &&
        (item.publishedAt === null || typeof item.publishedAt === "string") &&
        Boolean(safeWebUrl(item.link)) &&
        Boolean(safeWebUrl(item.sourceHomepage))
      );
    });
  } catch {
    return [];
  }
}

export function restoreSavedArticles(raw: string | null): ReadingArticle[] {
  if (!raw) return [];
  try { return validateArticles(JSON.parse(raw)); }
  catch { return []; }
}

export function mergeArticles(
  current: ReadingArticle[],
  incoming: ReadingArticle[],
): ReadingArticle[] {
  const merged = new Map(current.map((article) => [article.id, article]));
  for (const article of incoming) merged.set(article.id, article);
  return Array.from(merged.values()).sort(
    (a, b) =>
      (Date.parse(b.publishedAt ?? "") || 0) -
        (Date.parse(a.publishedAt ?? "") || 0) || b.score - a.score,
  );
}

export function filterArticles(
  articles: ReadingArticle[],
  filters: {
    query: string;
    region: string;
    language: string;
    kind: string;
    ideology: string;
    topic: string;
    source: string;
    days: number;
    sort: string;
    preferredLanguage?: string;
  },
  now = Date.now(),
): ReadingArticle[] {
  const query = filters.query.trim().toLocaleLowerCase("it");
  return articles
    .filter((article) => {
      const published = Date.parse(article.publishedAt ?? "");
      return (
        (filters.region === "all" || article.region === filters.region) &&
        (filters.language === "all" || article.language === filters.language) &&
        (filters.kind === "all" || article.kind === filters.kind) &&
        (filters.ideology === "all" ||
          article.ideologies.includes(filters.ideology)) &&
        (filters.topic === "all" || article.topics.includes(filters.topic)) &&
        (filters.source === "all" || article.sourceId === filters.source) &&
        (!Number.isFinite(published) ||
          now - published <= filters.days * 864e5) &&
        (!query ||
          `${article.title} ${article.excerpt} ${article.sourceName} ${article.categories.join(" ")}`
            .toLocaleLowerCase("it")
            .includes(query))
      );
    })
    .sort(
      (a, b) =>
        (filters.preferredLanguage && filters.preferredLanguage !== "all"
          ? Number(b.language === filters.preferredLanguage) -
            Number(a.language === filters.preferredLanguage)
          : 0) ||
        (filters.sort === "score"
          ? b.score - a.score
          : filters.sort === "source"
            ? a.sourceName.localeCompare(b.sourceName, "it")
            : (Date.parse(b.publishedAt ?? "") || 0) -
                (Date.parse(a.publishedAt ?? "") || 0) || b.score - a.score),
    );
}

export function restoreNewsSnapshot(
  raw: string | null,
  now = Date.now(),
): { articles: ReadingArticle[]; updatedAt: number; fresh: boolean } | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (
      !value ||
      typeof value.updatedAt !== "number" ||
      !Array.isArray(value.articles) ||
      now - value.updatedAt > 864e5 ||
      value.updatedAt > now + 60_000
    )
      return null;
    const articles = restoreSavedArticles(JSON.stringify(value.articles)).slice(
      0,
      1200,
    );
    if (!articles.length) return null;
    return {
      articles,
      updatedAt: value.updatedAt,
      fresh: now - value.updatedAt < 600_000,
    };
  } catch {
    return null;
  }
}
