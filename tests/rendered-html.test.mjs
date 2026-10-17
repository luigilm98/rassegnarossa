import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the aggregator shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="it">/i);
  assert.match(html, /<title>Rassegna Rossa<\/title>/i);
  assert.match(html, /Aggregatore socialista globale/);
  assert.match(html, /prospettiva/);
  assert.match(html, /Atlante delle fonti/);
  assert.match(html, /Biblioteca/);
  assert.match(html, /Salvati/);
  assert.match(html, /Vai ai contenuti/);
  assert.match(html, /id="letture"/);
  assert.match(html, /aria-label="Cerca articoli"/);
  assert.match(html, /<dialog/);
  assert.doesNotMatch(html, /appgprj_|appgrepo_|@gmail\.com|art_v2_/i);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|SkeletonPreview/i,
  );
});

test("keeps the product detached from the starter preview", async () => {
  const [page, layout, packageJson, catalog, globals] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<AggregatorApp \/>/);
  assert.match(layout, /title:\s*"Rassegna Rossa"/);
  assert.match(layout, /lang="it"/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(catalog, /id:\s*"ottolina"/);
  assert.match(catalog, /id:\s*"ottolina-dazibao"/);
  assert.match(catalog, /id:\s*"google-news-socialismo-it"/);
  assert.match(catalog, /id:\s*`radar-\$\{locale\.id\}-\$\{query\.id\}`/);
  assert.match(catalog, /name:\s*"Russia"/);
  assert.match(catalog, /name:\s*"Cina"/);
  assert.match(globals, /prefers-reduced-motion/);
  assert.match(globals, /focus-visible/);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("serves the source directory and handles unavailable sources without network", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const response = await worker.fetch(
    new Request("http://localhost/api/sources"),
    env,
    ctx,
  );
  assert.equal(response.status, 200);
  const directory = await response.json();
  assert.ok(directory.sources.length > 0);
  assert.ok(directory.sources.some((s) => s.id === "ottolina"));
  const empty = await worker.fetch(
    new Request("http://localhost/api/articles?sourceIds=does-not-exist"),
    env,
    ctx,
  );
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).articles, []);
});

test("translation validates empty text and preserves same-language content", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const request = (body) =>
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const invalid = await worker.fetch(request({ text: "" }), env, ctx);
  assert.equal(invalid.status, 400);
  const same = await worker.fetch(
    request({ text: "Una lettura", from: "it", to: "it" }),
    env,
    ctx,
  );
  assert.equal(same.status, 200);
  assert.equal((await same.json()).translatedText, "Una lettura");
});
