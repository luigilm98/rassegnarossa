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
  assert.match(html, /Aggiorna mondo/);
  assert.match(html, /Lista fonti/);
  assert.match(html, /Notizie navigabili/);
  assert.match(html, /Teoria/);
  assert.match(html, /Fonti/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|SkeletonPreview/i);
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
  assert.doesNotMatch(globals, /letter-spacing:\s*-/);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
