import type { SourceDefinition } from "../data/catalog";

/** All sources participate. Ordering balances early responses across world regions. */
export function collectionOrder(
  sources: SourceDefinition[],
  preferred: string,
): SourceDefinition[] {
  const ranked = sources
    .slice()
    .sort(
      (a, b) =>
        Number(b.language === preferred) - Number(a.language === preferred) ||
        Number(a.kind === "radar") - Number(b.kind === "radar") ||
        b.priority - a.priority,
    );
  const opening = ranked
    .filter(
      (source) => source.language === preferred && source.kind !== "radar",
    )
    .slice(0, 6);
  const selected = new Set(opening.map((source) => source.id));
  const groups = new Map<string, SourceDefinition[]>();
  for (const source of ranked) {
    if (selected.has(source.id)) continue;
    const list = groups.get(`${source.region}:${source.language}`) ?? [];
    list.push(source);
    groups.set(`${source.region}:${source.language}`, list);
  }
  const result = [...opening];
  while ([...groups.values()].some((group) => group.length))
    for (const group of groups.values()) {
      const source = group.shift();
      if (source && !selected.has(source.id)) {
        selected.add(source.id);
        result.push(source);
      }
    }
  return result;
}

/** Finite queue, bounded concurrency and per-item deadline; no user-driven source pages. */
export async function collectAll<T, R>({
  items,
  worker,
  signal,
  onResult,
  onError,
  onProgress,
  concurrency = 10,
  timeoutMs = 10000,
}: {
  items: T[];
  worker: (item: T, signal: AbortSignal) => Promise<R>;
  signal: AbortSignal;
  onResult: (item: T, result: R) => void;
  onError: (item: T) => void;
  onProgress: (done: number, total: number) => void;
  concurrency?: number;
  timeoutMs?: number;
}) {
  let cursor = 0,
    done = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      async () => {
        while (cursor < items.length && !signal.aborted) {
          const item = items[cursor++];
          const local = new AbortController();
          const abort = () => local.abort();
          signal.addEventListener("abort", abort, { once: true });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const deadline = new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                local.abort();
                reject(new Error("Source deadline"));
              }, timeoutMs);
            });
            const result = await Promise.race([
              worker(item, local.signal),
              deadline,
            ]);
            if (!signal.aborted) onResult(item, result);
          } catch {
            if (!signal.aborted) onError(item);
          } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            if (!signal.aborted) {
              done++;
              onProgress(done, items.length);
            }
          }
        }
      },
    ),
  );
}
