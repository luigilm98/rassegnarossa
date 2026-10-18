/** Existing cards retain their positions; new arrivals append until an explicit reorder. */
export function retainArticleOrder<T extends { id: string }>(previous: string[], ranked: T[]): T[] {
  const remaining = new Map(ranked.map(article => [article.id, article]));
  const result: T[] = [];
  for (const id of previous) {
    const article = remaining.get(id);
    if (article) { result.push(article); remaining.delete(id); }
  }
  return [...result, ...remaining.values()];
}
