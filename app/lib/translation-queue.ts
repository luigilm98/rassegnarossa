export type TranslationTask = { key: string; text: string; from: string; to: string; priority: number };
/** One failed text cannot pause other articles; old locales do not fill the queue. */
export function createTranslationQueue(worker: (task: TranslationTask) => Promise<string>, concurrency = 3) {
  const pending: (TranslationTask & { done: (value: string | null) => void })[] = [];
  const requests = new Map<string, Promise<string | null>>();
  let active = 0;
  const drain = () => {
    while (active < concurrency && pending.length) {
      const task = pending.shift()!;
      active++;
      void (async () => {
        try { task.done(await worker(task)); }
        catch { task.done(null); }
        finally { requests.delete(task.key); active--; drain(); }
      })();
    }
  };
  return {
    enqueue(task: TranslationTask): Promise<string | null> {
      const existing = requests.get(task.key);
      if (existing) return existing;
      const promise = new Promise<string | null>(done => { pending.push({ ...task, done }); pending.sort((a, b) => b.priority - a.priority); });
      requests.set(task.key, promise); drain(); return promise;
    },
    keepTarget(to: string) {
      for (let index = pending.length - 1; index >= 0; index--) {
        const task = pending[index];
        if (task.to === to) continue;
        pending.splice(index, 1); requests.delete(task.key); task.done(null);
      }
    },
  };
}
