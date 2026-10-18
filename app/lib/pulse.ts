import type { ArticleRecord } from "./feed";

export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
export type PulseStory = {
  article: ArticleRecord;
  coverage: ArticleRecord[];
  score: number;
  freshness: number;
  breadth: number;
};
const STOP = new Set(
  "the and for with from this that are was were has have una uno con per del della delle degli che nel una los las por para les des une dans die der das und mit von il lo la di da a in e un su al le gli en el de to of on is at as by an it".split(
    " ",
  ),
);
function tokens(title: string) {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((word) => !STOP.has(word)) ?? [],
  );
}
function sameStory(left: ArticleRecord, right: ArticleRecord) {
  if (left.link === right.link) return true;
  const a = tokens(left.title),
    b = tokens(right.title);
  if (!a.size || !b.size || left.language !== right.language) return false;
  const common = [...a].filter((word) => b.has(word)).length;
  return common >= 4 && common / Math.max(a.size, b.size) >= 0.72;
}
/** A transparent signal of visibility in the sampled feeds, never a truth rating. */
export function rankPulse(
  articles: ArticleRecord[],
  now = Date.now(),
): PulseStory[] {
  const recent = articles
    .filter((article) => {
      const time = article.publishedAt ? Date.parse(article.publishedAt) : NaN;
      return Number.isFinite(time) && time <= now && time >= now - SIX_HOURS_MS;
    })
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
  const groups: ArticleRecord[][] = [];
  const links = new Set<string>();
  for (const article of recent) {
    if (links.has(article.link)) continue;
    links.add(article.link);
    const group = groups.find((group) => sameStory(group[0], article));
    if (group) group.push(article);
    else groups.push([article]);
  }
  return groups
    .map((coverage) => {
      const article = coverage[0];
      const freshness = Math.round(
        50 * (1 - (now - Date.parse(article.publishedAt!)) / SIX_HOURS_MS),
      );
      // Publisher names, not the number of radar queries containing a story.
      const breadth = Math.min(
        50,
        (new Set(coverage.map((a) => a.sourceName.toLowerCase())).size - 1) *
          15,
      );
      return {
        article,
        coverage,
        freshness,
        breadth,
        score: freshness + breadth,
      };
    })
    .sort(
      (a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id),
    );
}
