/** Three complete failures pause only the failing language pair, never the entire queue. */
export function createAvailabilityCircuit(threshold = 3, cooldownMs = 30000, clock = Date.now) {
  const pairs = new Map<string, { failures: number; until: number }>();
  return {
    blocked(key: string) { return (pairs.get(key)?.until ?? 0) > clock(); },
    success(key: string) { pairs.delete(key); },
    failure(key: string) {
      const previous = pairs.get(key);
      if (previous && previous.until > clock()) return;
      const failures = (previous && !previous.until ? previous.failures : 0) + 1;
      pairs.set(key, { failures, until: failures >= threshold ? clock() + cooldownMs : 0 });
    },
    clear() { pairs.clear(); },
  };
}
