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
  const groupTokens: Set<string>[] = [];
  // Only group representatives are indexed: preserve the original first-match grouping.
  const index = new Map<string, number[]>();
  const links = new Set<string>();
  for (const article of recent) {
    if (links.has(article.link)) continue;
    links.add(article.link);
    const words = tokens(article.title);
    const candidates = new Map<number, number>();
    for (const word of words) {
      for (const group of index.get(`${article.language}:${word}`) ?? [])
        candidates.set(group, (candidates.get(group) ?? 0) + 1);
    }
    let matched = Infinity;
    for (const [group, common] of candidates) {
      if (group < matched && common >= 4 && common / Math.max(words.size, groupTokens[group].size) >= 0.72)
        matched = group;
    }
    if (matched !== Infinity) groups[matched].push(article);
    else {
      const group = groups.length;
      groups.push([article]);
      groupTokens.push(words);
      if (words.size >= 4) for (const word of words) {
        const key = `${article.language}:${word}`;
        const posting = index.get(key);
        if (posting) posting.push(group);
        else index.set(key, [group]);
      }
    }
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
