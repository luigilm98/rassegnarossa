/** First result is immediate; bursts produce one state update, with explicit final flush/cancellation. */
export function createBatchedSink<T>(publish: (items: T[]) => void, delayMs = 120) {
  let pending: T[] = [];
  let first = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer); timer = undefined;
    if (!pending.length) return;
    const items = pending; pending = [];
    publish(items);
  };
  return {
    push(item: T) {
      pending.push(item);
      if (first) { first = false; flush(); }
      else timer ??= setTimeout(flush, delayMs);
    },
    flush,
    clear() { clearTimeout(timer); timer = undefined; pending = []; },
  };
}
