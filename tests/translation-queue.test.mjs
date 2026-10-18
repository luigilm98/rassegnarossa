import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationQueue } from "../app/lib/translation-queue.ts";
const task = (key, to = "it", priority = 0) => ({ key, to, from: "en", text: key, priority });

test("a failed article does not stop subsequent translations and the same text is requested once", async () => {
 const seen = [];
 const queue = createTranslationQueue(async item => { seen.push(item.key); if (item.key === "bad") throw new Error("Provider failure"); return `Tradotto ${item.key}`; }, 1);
 const bad = queue.enqueue(task("bad"));
 const french = queue.enqueue(task("french"));
 const duplicate = queue.enqueue(task("french"));
 const chinese = queue.enqueue(task("chinese"));
 assert.equal(french, duplicate);
 assert.deepEqual(await Promise.all([bad, french, chinese]), [null, "Tradotto french", "Tradotto chinese"]);
 assert.deepEqual(seen, ["bad", "french", "chinese"]);
 assert.equal(await queue.enqueue(task("bad-fixed")), "Tradotto bad-fixed");
});

test("changing reading language removes queued old-language work and allows a new target to proceed", async () => {
 let finish;
 const seen = [];
 const queue = createTranslationQueue(async item => { seen.push(item.key); if (item.key === "active") await new Promise(resolve => { finish = resolve; }); return item.to; }, 1);
 const active = queue.enqueue(task("active", "es"));
 const obsolete = queue.enqueue(task("old", "es"));
 const current = queue.enqueue(task("new", "it"));
 queue.keepTarget("it");
 assert.equal(await obsolete, null);
 finish();
 assert.equal(await active, "es");
 assert.equal(await current, "it");
 assert.deepEqual(seen, ["active", "new"]);
});

test("visible headlines retain priority without exceeding the concurrency limit", async () => {
 let finish, active = 0, peak = 0;
 const order = [];
 const queue = createTranslationQueue(async item => {
  active++; peak = Math.max(peak, active); order.push(item.key);
  if (item.key === "first") await new Promise(resolve => { finish = resolve; });
  active--; return item.key;
 }, 1);
 const first = queue.enqueue(task("first"));
 const body = queue.enqueue(task("body", "it", 1));
 const headline = queue.enqueue(task("headline", "it", 2));
 finish(); await Promise.all([first, body, headline]);
 assert.equal(peak, 1); assert.deepEqual(order, ["first", "headline", "body"]);
});
