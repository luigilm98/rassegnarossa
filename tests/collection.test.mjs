import test from "node:test";
import assert from "node:assert/strict";
import { collectAll } from "../app/lib/collection.ts";

test("all sources run automatically with bounded concurrency despite failures and a stalled source", async () => {
  let active = 0,
    peak = 0;
  const started = [],
    results = [],
    failed = [],
    progress = [];
  await collectAll({
    items: Array.from({ length: 41 }, (_, i) => i),
    concurrency: 4,
    timeoutMs: 30,
    signal: new AbortController().signal,
    worker: async (item, signal) => {
      started.push(item);
      active++;
      peak = Math.max(peak, active);
      try {
        if (item === 3)
          return await new Promise((_, reject) =>
            signal.addEventListener(
              "abort",
              () => reject(new Error("Timeout")),
              { once: true },
            ),
          );
        if (item === 8) throw new Error("Offline");
        await new Promise((resolve) => setTimeout(resolve, 1));
        return item;
      } finally {
        active--;
      }
    },
    onResult: (_, value) => results.push(value),
    onError: (item) => failed.push(item),
    onProgress: (done) => progress.push(done),
  });
  assert.equal(started.length, 41);
  assert.equal(new Set(started).size, 41);
  assert.ok(peak <= 4);
  assert.deepEqual(
    failed.sort((a, b) => a - b),
    [3, 8],
  );
  assert.equal(results.length, 39);
  assert.equal(progress.at(-1), 41);
  assert.ok(results.includes(40));
});

test("cancellation stops queued work and stale callbacks", async () => {
  const controller = new AbortController();
  const seen = [],
    completed = [];
  await collectAll({
    items: [1, 2, 3, 4],
    concurrency: 1,
    signal: controller.signal,
    timeoutMs: 20,
    worker: async (item) => {
      seen.push(item);
      controller.abort();
      return item;
    },
    onResult: (_, value) => completed.push(value),
    onError: () => assert.fail("No canceled errors"),
    onProgress: () => assert.fail("No stale progress"),
  });
  assert.deepEqual(seen, [1]);
  assert.deepEqual(completed, []);
});
