/** Retain completed values only, with explicit memory and entry budgets. */
export function createBoundedCache<K, V>(maxEntries: number, maxWeight: number, weigh: (value: V, key: K) => number) {
  const values = new Map<K, { value: V; weight: number }>();
  let weight = 0;
  return {
    get(key: K): V | undefined { return values.get(key)?.value; },
    set(key: K, value: V) {
      const previous = values.get(key);
      if (previous) { weight -= previous.weight; values.delete(key); }
      const nextWeight = weigh(value, key);
      if (nextWeight > maxWeight) return;
      while (values.size && (values.size >= maxEntries || weight + nextWeight > maxWeight)) {
        const oldest = values.keys().next().value!;
        weight -= values.get(oldest)!.weight;
        values.delete(oldest);
      }
      values.set(key, { value, weight: nextWeight });
      weight += nextWeight;
    },
  };
}
